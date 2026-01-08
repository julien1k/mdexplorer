import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

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

// Helper: format file tree for display
interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
  children?: FileNode[];
}

async function buildFileTree(dirPath: string): Promise<FileNode[]> {
  const results: FileNode[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip common excluded directories
      const lowerName = entry.name.toLowerCase();
      if (lowerName === 'node_modules' || lowerName === '.git' || 
          lowerName === '.next' || lowerName === '__pycache__' ||
          lowerName === '.vscode') {
        continue;
      }
      
      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children,
        });
      } else {
        results.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          extension: path.extname(entry.name).toLowerCase(),
        });
      }
    }
    
    // Sort: directories first, then files
    results.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return results;
}

/**
 * POST /api/chat/execute-tool
 * Executes approved tool calls after user permission
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toolName, parameters, rootDirectory } = body;

    if (!toolName) {
      return Response.json(
        { success: false, error: "Tool name is required" },
        { status: 400 }
      );
    }

    console.log(`[execute-tool] Executing ${toolName} with parameters:`, parameters);

    // Execute the appropriate tool
    switch (toolName) {
      case "readMarkdownFile": {
        const { filePath } = parameters;
        
        // Security validation
        if (rootDirectory) {
          const isValid = await validatePath(filePath, rootDirectory);
          if (!isValid) {
            return Response.json({
              success: false,
              error: `Access denied: Path is outside the allowed directory`,
            });
          }
        }

        // Read the file
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const stats = await fs.stat(filePath);
          
          return Response.json({
            success: true,
            data: {
              filePath,
              content,
              fileName: path.basename(filePath),
              size: stats.size,
              modified: stats.mtime,
            },
          });
        } catch (error) {
          return Response.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file",
          });
        }
      }

      case "searchMarkdownFiles": {
        const { pattern } = parameters;
        
        if (!rootDirectory) {
          return Response.json({
            success: false,
            error: "No root directory configured",
          });
        }

        try {
          const files = await findMarkdownFiles(rootDirectory, pattern);
          
          return Response.json({
            success: true,
            data: {
              files: files.map(f => ({
                path: f,
                name: path.basename(f),
                relativePath: path.relative(rootDirectory, f),
              })),
              count: files.length,
              pattern: pattern || "*",
            },
          });
        } catch (error) {
          return Response.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to search files",
          });
        }
      }

      case "searchMarkdownContent": {
        const { query, filePattern } = parameters;
        
        if (!rootDirectory) {
          return Response.json({
            success: false,
            error: "No root directory configured",
          });
        }

        try {
          // First find matching files
          const files = await findMarkdownFiles(rootDirectory, filePattern);
          
          // Search within each file
          const results: Array<{
            file: string;
            relativePath: string;
            matches: Array<{ line: number; text: string }>;
          }> = [];

          for (const file of files) {
            const matches = await searchInFile(file, query);
            if (matches.length > 0) {
              results.push({
                file,
                relativePath: path.relative(rootDirectory, file),
                matches,
              });
            }
          }

          return Response.json({
            success: true,
            data: {
              query,
              results,
              totalFiles: files.length,
              filesWithMatches: results.length,
              totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
            },
          });
        } catch (error) {
          return Response.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to search content",
          });
        }
      }

      case "listFileTree": {
        if (!rootDirectory) {
          return Response.json({
            success: false,
            error: "No root directory configured",
          });
        }

        try {
          const tree = await buildFileTree(rootDirectory);
          
          return Response.json({
            success: true,
            data: {
              tree,
              rootDirectory,
            },
          });
        } catch (error) {
          return Response.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to list files",
          });
        }
      }

      default:
        return Response.json(
          { success: false, error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[execute-tool] Error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
