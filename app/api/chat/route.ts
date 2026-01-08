import { ToolLoopAgent, createAgentUIStreamResponse, tool, stepCountIs } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import {
  isValidModelId,
  getModelInstance,
  getProviderFromModelId,
  DEFAULT_MODEL_ID,
} from "@/lib/models";
import { readDirectory } from "@/actions/file-actions";
import type { FileNode } from "@/types";

// Security: validate path is within allowed directory
async function validatePath(filePath: string, rootDirectory: string): Promise<boolean> {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootDirectory);
  return resolvedPath.startsWith(resolvedRoot);
}

// Helper: recursively search for markdown files
async function findMarkdownFiles(dirPath: string, pattern?: string): Promise<string[]> {
  const results: string[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip common excluded directories
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        if (lowerName === 'node_modules' || lowerName === '.git' || 
            lowerName === '.next' || lowerName === '__pycache__') {
          continue;
        }
        // Recurse into subdirectories
        const subResults = await findMarkdownFiles(fullPath, pattern);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        // Check if file matches pattern (if provided)
        if (!pattern || entry.name.toLowerCase().includes(pattern.toLowerCase())) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return results;
}

// Helper: search file content for a query
async function searchInFile(filePath: string, query: string): Promise<{ line: number; text: string }[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: { line: number; text: string }[] = [];
    const lowerQuery = query.toLowerCase();
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({ line: index + 1, text: line.trim() });
      }
    });
    
    return matches;
  } catch (error) {
    return [];
  }
}

// Keywords that should trigger forced tool usage
const EDIT_KEYWORDS = [
  "save", "update", "rewrite", "edit", "change", "modify", "add", "remove",
  "delete", "insert", "append", "prepend", "replace", "refactor", "fix",
  "improve", "optimize", "summarize into", "write to", "put in", "generate",
  "create", "make", "transform", "convert", "format", "restructure"
];

function shouldForceToolUse(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return EDIT_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

// Create the proposeDocumentChange tool - returns proposed content instead of writing to disk
// The frontend will show a diff view and let the user accept or reject
function createProposeDocumentChangeTool(rootDirectory?: string) {
  return tool({
    description: `CRITICAL: Use this tool to propose changes to the currently open markdown file.
You MUST use this tool whenever the user requests ANY of the following:
- Modifications, edits, or changes to the document
- Adding, removing, or updating content
- Refactoring, summarizing, or restructuring the file
- Content generation or writing within the file itself
- Fixing errors, improving text, or optimizing content

Do NOT describe changes in chat - USE THIS TOOL to propose them directly.
The user will see a diff view comparing the original with your proposed changes and can accept or reject.

IMPORTANT: Use the EXACT path provided in the context. The path must be absolute.`,
    inputSchema: z.object({
      path: z.string().describe("The EXACT absolute path from the context's 'Current File Path' - copy it exactly"),
      newContent: z.string().describe("The complete new content for the entire file - include ALL content, not just changes"),
      summary: z.string().describe("A brief 1-2 sentence summary of the changes made"),
    }),
    execute: async ({ path: targetPath, newContent, summary }) => {
      console.log("\n" + "=".repeat(60));
      console.log("[proposeDocumentChange] TOOL EXECUTION STARTED");
      console.log("=".repeat(60));
      console.log("[proposeDocumentChange] Target path:", targetPath);
      console.log("[proposeDocumentChange] Content preview (first 100 chars):", newContent.substring(0, 100).replace(/\n/g, "\\n"));
      console.log("[proposeDocumentChange] Content length:", newContent.length, "characters");
      console.log("[proposeDocumentChange] Summary:", summary);
      console.log("[proposeDocumentChange] Root directory:", rootDirectory || "NOT SET");

      // Validate path is provided
      if (!targetPath || targetPath.trim() === "") {
        const error = "ERROR: No file path provided. The AI must use the exact path from the context.";
        console.error("[proposeDocumentChange]", error);
        return {
          success: false,
          type: "error" as const,
          error,
          hint: "Use the path exactly as shown in the 'Current File Path' context.",
        };
      }

      // Security check
      if (rootDirectory) {
        const isValid = await validatePath(targetPath, rootDirectory);
        console.log("[proposeDocumentChange] Path validation:", isValid ? "PASSED" : "FAILED");
        if (!isValid) {
          const error = `Access denied: Path '${targetPath}' is outside the allowed directory '${rootDirectory}'`;
          console.error("[proposeDocumentChange]", error);
          return {
            success: false,
            type: "error" as const,
            error,
            hint: "Ensure you're using the exact path from the context, not a modified version.",
          };
        }
      }

      // Instead of writing to disk, return the proposed content for diff review
      console.log("[proposeDocumentChange] ✅ PROPOSAL READY FOR REVIEW");
      console.log("[proposeDocumentChange] Returning proposed content to frontend for diff view");
      console.log("=".repeat(60) + "\n");

      return {
        success: true,
        type: "proposal" as const,
        message: `Proposed changes ready for review: ${summary}`,
        path: targetPath,
        proposedContent: newContent,
        summary,
        contentLength: newContent.length,
        timestamp: new Date().toISOString(),
      };
    },
  });
}

// Create tool for reading markdown files with permission request
function createReadMarkdownFileTool(rootDirectory?: string) {
  return tool({
    description: `Read the content of a markdown file. This tool requires user permission before execution.
Use this when you need to examine the contents of a markdown file to answer questions or gather context.
The tool will request permission from the user before reading the file.`,
    inputSchema: z.object({
      filePath: z.string().describe("The absolute path to the markdown file to read"),
      reason: z.string().describe("A clear explanation of why you need to read this file (shown to the user for permission)"),
    }),
    execute: async ({ filePath, reason }) => {
      console.log(`[readMarkdownFile] Permission requested to read: ${filePath}`);
      console.log(`[readMarkdownFile] Reason: ${reason}`);
      
      // Security validation
      if (rootDirectory) {
        const isValid = await validatePath(filePath, rootDirectory);
        if (!isValid) {
          return {
            success: false,
            error: `Access denied: Path '${filePath}' is outside the allowed directory`,
            requiresPermission: false,
          };
        }
      }
      
      // Check if file exists and is markdown
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          return {
            success: false,
            error: "Path is not a file",
            requiresPermission: false,
          };
        }
        
        if (!filePath.toLowerCase().endsWith('.md')) {
          return {
            success: false,
            error: "File is not a markdown file",
            requiresPermission: false,
          };
        }
        
        // Request permission from user
        return {
          success: false,
          requiresPermission: true,
          permissionRequest: {
            toolName: "readMarkdownFile",
            filePath,
            reason,
            action: "read",
          },
          message: `⚠️ Permission Required: The AI wants to read '${path.basename(filePath)}' because: ${reason}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "File not found",
          requiresPermission: false,
        };
      }
    },
  });
}

// Create tool for searching markdown files with permission request
function createSearchMarkdownFilesTool(rootDirectory?: string) {
  return tool({
    description: `Search for markdown files in the workspace. This tool requires user permission before execution.
Use this to find markdown files by name pattern or to get a list of all markdown files.
The tool will request permission from the user before searching.`,
    inputSchema: z.object({
      pattern: z.string().optional().describe("Optional search pattern to filter files by name (case-insensitive)"),
      reason: z.string().describe("A clear explanation of why you need to search for files (shown to the user for permission)"),
    }),
    execute: async ({ pattern, reason }) => {
      console.log(`[searchMarkdownFiles] Permission requested`);
      console.log(`[searchMarkdownFiles] Pattern: ${pattern || 'all files'}`);
      console.log(`[searchMarkdownFiles] Reason: ${reason}`);
      
      if (!rootDirectory) {
        return {
          success: false,
          error: "No root directory configured",
          requiresPermission: false,
        };
      }
      
      // Request permission from user
      return {
        success: false,
        requiresPermission: true,
        permissionRequest: {
          toolName: "searchMarkdownFiles",
          pattern: pattern || "*",
          reason,
          action: "search",
        },
        message: `⚠️ Permission Required: The AI wants to search for markdown files${pattern ? ` matching '${pattern}'` : ''} because: ${reason}`,
      };
    },
  });
}

// Create tool for searching content within markdown files with permission request
function createSearchMarkdownContentTool(rootDirectory?: string) {
  return tool({
    description: `Search for specific text content within markdown files. This tool requires user permission before execution.
Use this to find which markdown files contain specific text, keywords, or phrases.
Returns matching files with line numbers and context.
The tool will request permission from the user before searching.`,
    inputSchema: z.object({
      query: z.string().describe("The text to search for within markdown files"),
      filePattern: z.string().optional().describe("Optional filename pattern to limit search scope"),
      reason: z.string().describe("A clear explanation of why you need to search file contents (shown to the user for permission)"),
    }),
    execute: async ({ query, filePattern, reason }) => {
      console.log(`[searchMarkdownContent] Permission requested`);
      console.log(`[searchMarkdownContent] Query: ${query}`);
      console.log(`[searchMarkdownContent] File Pattern: ${filePattern || 'all files'}`);
      console.log(`[searchMarkdownContent] Reason: ${reason}`);
      
      if (!rootDirectory) {
        return {
          success: false,
          error: "No root directory configured",
          requiresPermission: false,
        };
      }
      
      // Request permission from user
      return {
        success: false,
        requiresPermission: true,
        permissionRequest: {
          toolName: "searchMarkdownContent",
          query,
          filePattern: filePattern || "*",
          reason,
          action: "search-content",
        },
        message: `⚠️ Permission Required: The AI wants to search for '${query}' in markdown files because: ${reason}`,
      };
    },
  });
}

// Create tool for listing the file tree with permission request
function createListFileTreeTool(rootDirectory?: string) {
  return tool({
    description: `Get a tree view of the file structure. This tool requires user permission before execution.
Use this to understand the organization of files and folders in the workspace.
The tool will request permission from the user before listing files.`,
    inputSchema: z.object({
      reason: z.string().describe("A clear explanation of why you need to see the file tree (shown to the user for permission)"),
    }),
    execute: async ({ reason }) => {
      console.log(`[listFileTree] Permission requested`);
      console.log(`[listFileTree] Reason: ${reason}`);
      
      if (!rootDirectory) {
        return {
          success: false,
          error: "No root directory configured",
          requiresPermission: false,
        };
      }
      
      // Request permission from user
      return {
        success: false,
        requiresPermission: true,
        permissionRequest: {
          toolName: "listFileTree",
          reason,
          action: "list-files",
        },
        message: `⚠️ Permission Required: The AI wants to view the file structure because: ${reason}`,
      };
    },
  });
}

// Base system instructions for the agent
const BASE_INSTRUCTIONS = `You are an AI-NATIVE COPILOT integrated into a markdown editor called "MD Explorer".

## CRITICAL INSTRUCTION - TOOL USAGE IS MANDATORY:
You have access to several tools for working with markdown files. When a user asks you to "summarize into the file", "refactor", "add", "change", "edit", "update", "fix", "improve", "write", "generate", "create", "modify", or make ANY changes to the document, you MUST use the \`proposeDocumentChange\` tool.

**DO NOT simply describe the changes in chat. PROPOSE the changes using the tool.**

The user will see a diff view comparing your proposed changes with the original and can Accept or Reject them.

**DECISION RULE:** If you are unsure whether to edit or chat, PRIORITIZE PROPOSING EDITS first, then provide a brief summary of what you changed in your response.

## PERMISSION SYSTEM:
**ALL TOOLS REQUIRE USER PERMISSION BEFORE EXECUTION.**
When you call a tool, you MUST provide a clear "reason" explaining why you need to use it. The user will see this reason and can approve or deny the request. Always be transparent about your intentions.

## REASONING PROTOCOL - THINK BEFORE ACTING:
Before using any tool, you MUST explicitly state your reasoning. Use this format:

**Thought:** [Your analysis of what the user wants]
**Plan:**
1. [First step]
2. [Second step]
...
**Document Analysis:** [Identify the current structure - headings, sections, key content areas]
**Target Location:** [Specify exactly WHERE in the document the changes will go]
**Action:** [Now call the tool with a clear reason]

This ensures thorough analysis before making changes.

## Your Capabilities:
1. **Propose Document Changes**: Use \`proposeDocumentChange\` to suggest modifications. The user will review in a diff view.
2. **Read Markdown Files**: Use \`readMarkdownFile\` to read the contents of any markdown file in the workspace (requires permission).
3. **Search for Files**: Use \`searchMarkdownFiles\` to find markdown files by name pattern (requires permission).
4. **Search Content**: Use \`searchMarkdownContent\` to search for text within markdown files (requires permission).
5. **View File Tree**: Use \`listFileTree\` to see the workspace structure (requires permission).
6. **Explain Content**: Analyze and explain markdown files when explicitly asked.
7. **Markdown Expert**: You understand all markdown syntax including GFM, tables, code blocks, and more.

## Context You Receive:
- **Current File Path**: The EXACT absolute path to the file - COPY THIS EXACTLY for the \`path\` parameter. Do not modify it.
- **Current File Content**: The COMPLETE content of the file - you see EVERYTHING, not a snippet.
- **Selected Text** (optional): Focus edits on this portion if provided.

## Tool Usage - CRITICAL REQUIREMENTS:
1. **Path**: Use the EXACT path from "Current File Path" - copy it character-for-character.
2. **Content**: Include the ENTIRE file content in \`newContent\`, not just the changed parts.
3. **Summary**: Provide a clear 1-2 sentence description of what changed.

## Guidelines:
- ALWAYS use \`proposeDocumentChange\` for any modification request - never just describe changes.
- Preserve the user's writing style when editing.
- When editing selected text, only modify that portion unless explicitly asked otherwise.
- Always maintain proper markdown formatting.
- The tool sends the entire proposed file, so include ALL content (modified + unchanged).

## CRITICAL FORMATTING RULE:
- Do NOT use **bold**, *italics*, or any special markdown markers to indicate or highlight your changes.
- Your edits must blend seamlessly with the original document. Do not "show your work" by marking what you changed.
- Act as a silent co-author: the reader should not be able to tell which parts you wrote vs. the original content.
- Maintain the existing style, tone, and formatting conventions of the original text perfectly.

## Response Format After Tool Use:
After the tool executes successfully, provide a brief confirmation:
- What was changed
- Where in the document
- Remind the user they can Accept or Reject the changes in the diff view

## Example Workflow:
User: "Add a table of contents to the file"

**Thought:** The user wants a table of contents added. I need to analyze the document structure first.
**Plan:**
1. Identify all headings in the document
2. Generate TOC with proper links
3. Insert at the top after any front matter
**Document Analysis:** The document has 3 main sections: Introduction, Features, Installation
**Target Location:** After the title, before the first section
**Action:** [Call proposeDocumentChange with the EXACT path and the full content including the new TOC]

→ "I've proposed adding a table of contents with links to your 3 main sections. Please review the changes in the diff view and click Accept or Reject."`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      model = DEFAULT_MODEL_ID,
      filePath,
      fileContent,
      selectedText,
      rootDirectory,
    }: {
      messages: unknown;
      model?: string;
      filePath?: string;
      fileContent?: string;
      selectedText?: string;
      rootDirectory?: string;
    } = body;

    // Validate model using centralized config
    if (!isValidModelId(model)) {
      return new Response(JSON.stringify({ error: "Invalid model" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Context verification logging
    console.log("[Chat API] Request context:", {
      hasFilePath: !!filePath,
      filePath: filePath || "NOT PROVIDED",
      hasFileContent: fileContent !== undefined,
      fileContentLength: fileContent?.length ?? 0,
      hasSelectedText: !!selectedText,
      selectedTextLength: selectedText?.length ?? 0,
      model,
      rootDirectory: rootDirectory || "NOT PROVIDED",
    });

    // Warn if critical context is missing
    if (!filePath) {
      console.warn("[Chat API] WARNING: No filePath provided - tool calls will fail!");
    }
    if (fileContent === undefined) {
      console.warn("[Chat API] WARNING: No fileContent provided - AI cannot see file contents!");
    }

    // Detect if we should force tool usage based on message keywords
    const lastUserMessage = Array.isArray(messages) 
      ? messages.filter((m: { role: string }) => m.role === "user").pop()
      : null;
    const lastMessageContent = lastUserMessage?.content || "";
    const forceToolUse = typeof lastMessageContent === "string" && shouldForceToolUse(lastMessageContent);
    
    if (forceToolUse) {
      console.log("[Chat API] Edit keywords detected - will encourage tool usage");
    }

    // Build context message
    let contextMessage = "";
    
    if (filePath) {
      contextMessage += `\n## Current File\n**Path:** \`${filePath}\`\n`;
    }
    
    if (fileContent !== undefined) {
      contextMessage += `\n**Content:**\n\`\`\`markdown\n${fileContent}\n\`\`\`\n`;
    }
    
    if (selectedText) {
      contextMessage += `\n## Selected Text\nThe user has highlighted the following text:\n\`\`\`\n${selectedText}\n\`\`\`\n`;
    }

    // Build enhanced instructions with edit reminder if keywords detected
    let finalInstructions = BASE_INSTRUCTIONS + (contextMessage ? `\n\n---\n${contextMessage}` : "");
    
    if (forceToolUse) {
      finalInstructions += `\n\n---\n## ⚠️ ACTION REQUIRED\nThe user's message contains edit-related keywords. You MUST use the \`proposeDocumentChange\` tool to propose the requested changes. Do not just describe what you would do - actually propose it by calling the tool.`;
    }

    // Create the agent with dynamic model and context
    const modelInstance = getModelInstance(model);
    const providerName = getProviderFromModelId(model);
    console.log("[Chat API] Using model:", model, "| Provider:", providerName);
    
    const copilotAgent = new ToolLoopAgent({
      model: modelInstance,
      instructions: finalInstructions,
      tools: {
        proposeDocumentChange: createProposeDocumentChangeTool(rootDirectory),
        readMarkdownFile: createReadMarkdownFileTool(rootDirectory),
        searchMarkdownFiles: createSearchMarkdownFilesTool(rootDirectory),
        searchMarkdownContent: createSearchMarkdownContentTool(rootDirectory),
        listFileTree: createListFileTreeTool(rootDirectory),
      },
      toolChoice: forceToolUse ? "required" : "auto", // Force tool use when edit keywords detected
      stopWhen: stepCountIs(5), // Allow up to 5 steps for complex edits
    });

    // Return streaming response using the agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createAgentUIStreamResponse({
      agent: copilotAgent as any,
      uiMessages: messages as any[],
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
