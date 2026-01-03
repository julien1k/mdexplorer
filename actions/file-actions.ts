"use server";

import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { isMarkdownFile } from "@/lib/config";
import { readSettings } from "./settings-actions";
import type { FileNode, AppSettings } from "@/types";

const execAsync = promisify(exec);

/**
 * Check if a file or folder should be excluded based on settings
 */
function shouldExclude(name: string, isDirectory: boolean, settings: AppSettings): boolean {
  if (isDirectory) {
    return settings.excludedFolders.some((folder) => 
      name === folder || name.toLowerCase() === folder.toLowerCase()
    );
  }
  
  const ext = path.extname(name).toLowerCase();
  return settings.excludedExtensions.some((excludedExt) => 
    ext === excludedExt.toLowerCase()
  );
}

/**
 * Read directory contents recursively with settings-based filtering
 */
export async function readDirectory(dirPath?: string, providedSettings?: AppSettings): Promise<FileNode[]> {
  const settings = providedSettings || await readSettings();
  const targetPath = dirPath || settings.rootDirectory;

  try {
    // Ensure the directory exists
    await fs.access(targetPath);
  } catch {
    // Create the directory if it doesn't exist
    await fs.mkdir(targetPath, { recursive: true });
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip excluded files/folders based on settings
    if (shouldExclude(entry.name, entry.isDirectory(), settings)) continue;

    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, settings);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "directory",
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
        extension: path.extname(entry.name).toLowerCase(),
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "directory" ? -1 : 1;
  });
}

/**
 * Read file contents
 */
export async function readFile(filePath: string): Promise<string> {
  const settings = await readSettings();
  
  // Security: ensure the file is within the root directory
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(settings.rootDirectory);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Access denied: File is outside the allowed directory");
  }

  const content = await fs.readFile(resolvedPath, "utf-8");
  return content;
}

/**
 * Write content to a file
 */
export async function writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await readSettings();
    
    // Security: ensure the file is within the root directory
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error("Access denied: File is outside the allowed directory");
    }

    // Ensure the directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, "utf-8");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new markdown file
 */
export async function createMarkdownFile(
  parentPath: string,
  fileName: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const settings = await readSettings();
    
    // Ensure .md extension
    const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const filePath = path.join(parentPath || settings.rootDirectory, name);

    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error("Access denied: Path is outside the allowed directory");
    }

    // Check if file already exists
    try {
      await fs.access(resolvedPath);
      return { success: false, error: "File already exists" };
    } catch {
      // File doesn't exist, good to create
    }

    // Create the file with default content
    const defaultContent = `# ${fileName.replace(/\.md$/, "")}\n\nStart writing here...\n`;
    await fs.writeFile(resolvedPath, defaultContent, "utf-8");

    return { success: true, filePath: resolvedPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Open a file in the system's default application
 */
export async function openInSystemApp(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const resolvedPath = path.resolve(filePath);

    // Determine the command based on OS
    const platform = process.platform;
    let command: string;

    if (platform === "win32") {
      // Windows: use start command with empty title
      command = `start "" "${resolvedPath}"`;
    } else if (platform === "darwin") {
      // macOS: use open command
      command = `open "${resolvedPath}"`;
    } else {
      // Linux: use xdg-open
      command = `xdg-open "${resolvedPath}"`;
    }

    await execAsync(command);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Open a folder in the system's file explorer
 */
export async function openInExplorer(folderPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const resolvedPath = path.resolve(folderPath);

    // Verify it's a directory
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      // If it's a file, open the parent directory
      return openInExplorer(path.dirname(resolvedPath));
    }

    const platform = process.platform;
    let command: string;

    if (platform === "win32") {
      command = `explorer "${resolvedPath}"`;
    } else if (platform === "darwin") {
      command = `open "${resolvedPath}"`;
    } else {
      command = `xdg-open "${resolvedPath}"`;
    }

    await execAsync(command);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search for files matching a query
 */
export async function searchFiles(query: string): Promise<FileNode[]> {
  const settings = await readSettings();
  const results: FileNode[] = [];
  const lowerQuery = query.toLowerCase();

  async function searchInDirectory(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Use settings-based exclusion
        if (shouldExclude(entry.name, entry.isDirectory(), settings)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.name.toLowerCase().includes(lowerQuery)) {
          if (entry.isDirectory()) {
            results.push({
              name: entry.name,
              path: fullPath,
              type: "directory",
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

        if (entry.isDirectory()) {
          await searchInDirectory(fullPath);
        }
      }
    } catch {
      // Ignore errors for individual directories
    }
  }

  await searchInDirectory(settings.rootDirectory);

  // Sort results: markdown files first, then by name
  return results.sort((a, b) => {
    const aIsMarkdown = a.type === "file" && isMarkdownFile(a.name);
    const bIsMarkdown = b.type === "file" && isMarkdownFile(b.name);

    if (aIsMarkdown !== bIsMarkdown) {
      return aIsMarkdown ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get the root directory path (from settings)
 */
export async function getRootDirectory(): Promise<string> {
  const settings = await readSettings();
  return settings.rootDirectory;
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await readSettings();
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error("Access denied: File is outside the allowed directory");
    }

    await fs.unlink(resolvedPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve a wiki-style link to an absolute path
 * Supports formats like [[filename.md]] or [[subfolder/document.pdf]]
 */
export async function resolveWikiLink(
  linkTarget: string,
  currentFilePath?: string
): Promise<{ path: string; exists: boolean; isMarkdown: boolean } | null> {
  try {
    const settings = await readSettings();
    
    // Clean up the link target
    const cleanTarget = linkTarget.trim();
    if (!cleanTarget) return null;

    // Try to resolve relative to current file's directory first
    let resolvedPath: string | null = null;

    if (currentFilePath) {
      const currentDir = path.dirname(currentFilePath);
      const relativePath = path.join(currentDir, cleanTarget);
      const resolved = path.resolve(relativePath);
      
      // Check if it's within the root directory
      if (resolved.startsWith(path.resolve(settings.rootDirectory))) {
        try {
          await fs.access(resolved);
          resolvedPath = resolved;
        } catch {
          // File doesn't exist at relative path
        }
      }
    }

    // If not found, try resolving from root directory
    if (!resolvedPath) {
      const fromRoot = path.join(settings.rootDirectory, cleanTarget);
      const resolved = path.resolve(fromRoot);
      
      if (resolved.startsWith(path.resolve(settings.rootDirectory))) {
        try {
          await fs.access(resolved);
          resolvedPath = resolved;
        } catch {
          // File doesn't exist
        }
      }
    }

    // If still not found, search for the file by name
    if (!resolvedPath) {
      const fileName = path.basename(cleanTarget);
      const found = await findFileByName(fileName, settings.rootDirectory);
      if (found) {
        resolvedPath = found;
      }
    }

    if (!resolvedPath) {
      return null;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const isMarkdown = [".md", ".mdx", ".markdown"].includes(ext);

    return {
      path: resolvedPath,
      exists: true,
      isMarkdown,
    };
  } catch {
    return null;
  }
}

/**
 * Find a file by name recursively
 */
async function findFileByName(fileName: string, dirPath: string): Promise<string | null> {
  try {
    const settings = await readSettings();
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldExclude(entry.name, entry.isDirectory(), settings)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (!entry.isDirectory() && entry.name.toLowerCase() === fileName.toLowerCase()) {
        return fullPath;
      }

      if (entry.isDirectory()) {
        const found = await findFileByName(fileName, fullPath);
        if (found) return found;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}
