import { ToolLoopAgent, createAgentUIStreamResponse, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Allowed model IDs - expanded for deeper reasoning capabilities
const ALLOWED_MODELS = [
  "gpt-5.2",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-5-mini",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-latest",
] as const;
type ModelId = (typeof ALLOWED_MODELS)[number];

// Model provider mapping
function getModelInstance(modelId: string) {
  if (modelId.startsWith("claude")) {
    return anthropic(modelId);
  }
  return openai(modelId);
}

// Security: validate path is within allowed directory
async function validatePath(filePath: string, rootDirectory: string): Promise<boolean> {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootDirectory);
  return resolvedPath.startsWith(resolvedRoot);
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

// Base system instructions for the agent
const BASE_INSTRUCTIONS = `You are a FILE-EDITING AGENT integrated into a markdown editor called "MD Explorer".

## CRITICAL INSTRUCTION - TOOL USAGE IS MANDATORY:
You have access to the \`proposeDocumentChange\` tool. When a user asks you to "summarize into the file", "refactor", "add", "change", "edit", "update", "fix", "improve", "write", "generate", "create", "modify", or make ANY changes to the document, you MUST use the \`proposeDocumentChange\` tool.

**DO NOT simply describe the changes in chat. PROPOSE the changes using the tool.**

The user will see a diff view comparing your proposed changes with the original and can Accept or Reject them.

**DECISION RULE:** If you are unsure whether to edit or chat, PRIORITIZE PROPOSING EDITS first, then provide a brief summary of what you changed in your response.

## REASONING PROTOCOL - THINK BEFORE ACTING:
Before using any tool, you MUST explicitly state your reasoning. Use this format:

**Thought:** [Your analysis of what the user wants]
**Plan:**
1. [First step]
2. [Second step]
...
**Document Analysis:** [Identify the current structure - headings, sections, key content areas]
**Target Location:** [Specify exactly WHERE in the document the changes will go]
**Action:** [Now call the proposeDocumentChange tool]

This ensures thorough analysis before making changes.

## Your Capabilities:
1. **Propose Document Changes (PRIMARY)**: Use \`proposeDocumentChange\` to suggest modifications. The user will review in a diff view.
2. **Explain Content**: Analyze and explain markdown files when explicitly asked.
3. **Markdown Expert**: You understand all markdown syntax including GFM, tables, code blocks, and more.

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
      model = "gpt-5-mini",
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

    // Validate model
    if (!ALLOWED_MODELS.includes(model as ModelId)) {
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
    console.log("[Chat API] Using model:", model, "| Provider:", model.startsWith("claude") ? "anthropic" : "openai");
    
    const copilotAgent = new ToolLoopAgent({
      model: modelInstance,
      instructions: finalInstructions,
      tools: {
        proposeDocumentChange: createProposeDocumentChangeTool(rootDirectory),
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
