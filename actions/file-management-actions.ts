"use server";

import fs from "fs/promises";
import path from "path";
import { readSettings } from "./settings-actions";
import { removeRecentFile } from "./recent-files-actions";

/**
 * Validate that a path is within the root directory
 */
async function validatePathSecurity(targetPath: string): Promise<{ valid: boolean; resolvedPath: string; rootPath: string }> {
  const settings = await readSettings();
  const resolvedPath = path.resolve(targetPath);
  const rootPath = path.resolve(settings.rootDirectory);

  return {
    valid: resolvedPath.startsWith(rootPath),
    resolvedPath,
    rootPath,
  };
}

/**
 * Create a new file with optional content
 */
export async function createFile(
  parentPath: string,
  fileName: string,
  content: string = ""
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const settings = await readSettings();
    const targetDir = parentPath || settings.rootDirectory;
    const filePath = path.join(targetDir, fileName);

    // Security check
    const { valid, resolvedPath, rootPath } = await validatePathSecurity(filePath);
    if (!valid) {
      return { success: false, error: "Access denied: Path is outside the allowed directory" };
    }

    // Check if file already exists
    try {
      await fs.access(resolvedPath);
      return { success: false, error: "A file with this name already exists" };
    } catch {
      // File doesn't exist, we can create it
    }

    // Ensure the directory exists
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    // Create the file
    await fs.writeFile(resolvedPath, content, "utf-8");

    return { success: true, filePath: resolvedPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new folder
 */
export async function createFolder(
  parentPath: string,
  folderName: string
): Promise<{ success: boolean; folderPath?: string; error?: string }> {
  try {
    const settings = await readSettings();
    const targetDir = parentPath || settings.rootDirectory;
    const folderPath = path.join(targetDir, folderName);

    // Security check
    const { valid, resolvedPath } = await validatePathSecurity(folderPath);
    if (!valid) {
      return { success: false, error: "Access denied: Path is outside the allowed directory" };
    }

    // Check if folder already exists
    try {
      await fs.access(resolvedPath);
      return { success: false, error: "A folder with this name already exists" };
    } catch {
      // Folder doesn't exist, we can create it
    }

    // Create the folder
    await fs.mkdir(resolvedPath, { recursive: true });

    return { success: true, folderPath: resolvedPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Rename a file or folder
 */
export async function renameItem(
  oldPath: string,
  newName: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    // Security check for old path
    const { valid: oldValid, resolvedPath: oldResolved } = await validatePathSecurity(oldPath);
    if (!oldValid) {
      return { success: false, error: "Access denied: Source path is outside the allowed directory" };
    }

    // Construct new path
    const parentDir = path.dirname(oldResolved);
    const newPath = path.join(parentDir, newName);

    // Security check for new path
    const { valid: newValid, resolvedPath: newResolved } = await validatePathSecurity(newPath);
    if (!newValid) {
      return { success: false, error: "Access denied: Destination path is outside the allowed directory" };
    }

    // Check if target already exists
    try {
      await fs.access(newResolved);
      return { success: false, error: "An item with this name already exists" };
    } catch {
      // Target doesn't exist, we can proceed
    }

    // Rename the item
    await fs.rename(oldResolved, newResolved);

    return { success: true, newPath: newResolved };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Move a file or folder to a new location
 */
export async function moveItem(
  sourcePath: string,
  targetFolderPath: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    // Security check for source
    const { valid: sourceValid, resolvedPath: sourceResolved } = await validatePathSecurity(sourcePath);
    if (!sourceValid) {
      return { success: false, error: "Access denied: Source path is outside the allowed directory" };
    }

    // Construct destination path
    const itemName = path.basename(sourceResolved);
    const destinationPath = path.join(targetFolderPath, itemName);

    // Security check for destination
    const { valid: destValid, resolvedPath: destResolved } = await validatePathSecurity(destinationPath);
    if (!destValid) {
      return { success: false, error: "Access denied: Destination path is outside the allowed directory" };
    }

    // Prevent moving into itself (for folders)
    if (destResolved.startsWith(sourceResolved + path.sep)) {
      return { success: false, error: "Cannot move a folder into itself" };
    }

    // Check if target already exists
    try {
      await fs.access(destResolved);
      return { success: false, error: "An item with this name already exists at the destination" };
    } catch {
      // Target doesn't exist, we can proceed
    }

    // Ensure target directory exists
    await fs.mkdir(path.dirname(destResolved), { recursive: true });

    // Move the item
    await fs.rename(sourceResolved, destResolved);

    return { success: true, newPath: destResolved };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a file or folder
 * Uses trash package if available, otherwise falls back to fs.unlink/rmdir
 */
export async function deleteItem(
  itemPath: string,
  useTrash: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // Security check
    const { valid, resolvedPath } = await validatePathSecurity(itemPath);
    if (!valid) {
      return { success: false, error: "Access denied: Path is outside the allowed directory" };
    }

    // Check if item exists
    const stats = await fs.stat(resolvedPath);

    if (useTrash) {
      // Try to use trash package for safe deletion
      try {
        const { default: trash } = await import("trash");
        await trash(resolvedPath);
      } catch {
        // If trash fails, fall back to permanent deletion
        if (stats.isDirectory()) {
          await fs.rm(resolvedPath, { recursive: true });
        } else {
          await fs.unlink(resolvedPath);
        }
      }
    } else {
      // Permanent deletion
      if (stats.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: true });
      } else {
        await fs.unlink(resolvedPath);
      }
    }

    // Remove from recent files
    await removeRecentFile(resolvedPath);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Copy path to clipboard-friendly format
 * Returns the path as a string (client will copy to clipboard)
 */
export async function getPathForClipboard(
  itemPath: string,
  relative: boolean = false
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const settings = await readSettings();
    const resolvedPath = path.resolve(itemPath);
    const rootPath = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(rootPath)) {
      return { success: false, error: "Access denied: Path is outside the allowed directory" };
    }

    const resultPath = relative
      ? path.relative(rootPath, resolvedPath)
      : resolvedPath;

    return { success: true, path: resultPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Duplicate a file
 */
export async function duplicateFile(
  filePath: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    const { valid, resolvedPath } = await validatePathSecurity(filePath);
    if (!valid) {
      return { success: false, error: "Access denied: Path is outside the allowed directory" };
    }

    // Check if it's a file
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return { success: false, error: "Can only duplicate files" };
    }

    // Generate new name with " copy" suffix
    const ext = path.extname(resolvedPath);
    const baseName = path.basename(resolvedPath, ext);
    const dir = path.dirname(resolvedPath);

    let newName = `${baseName} copy${ext}`;
    let newPath = path.join(dir, newName);
    let counter = 1;

    // Find a unique name
    while (true) {
      try {
        await fs.access(newPath);
        counter++;
        newName = `${baseName} copy ${counter}${ext}`;
        newPath = path.join(dir, newName);
      } catch {
        // Name is available
        break;
      }
    }

    // Read original content and write to new file
    const content = await fs.readFile(resolvedPath, "utf-8");
    await fs.writeFile(newPath, content, "utf-8");

    return { success: true, newPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
