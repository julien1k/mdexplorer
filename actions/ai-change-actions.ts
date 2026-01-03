"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { readSettings } from "./settings-actions";

/**
 * Accept and apply a proposed AI change to the file system
 * This is called when the user clicks "Accept" in the diff view
 */
export async function acceptProposedChange(
  filePath: string,
  proposedContent: string
): Promise<{ success: boolean; error?: string; bytesWritten?: number }> {
  try {
    const settings = await readSettings();

    // Security: ensure the file is within the root directory
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return {
        success: false,
        error: "Access denied: File is outside the allowed directory",
      };
    }

    // Ensure the directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the proposed content to the file
    const contentBuffer = Buffer.from(proposedContent, "utf-8");
    await fs.writeFile(resolvedPath, contentBuffer);

    // Verify the write
    const stats = await fs.stat(resolvedPath);
    const bytesWritten = stats.size;

    console.log("[acceptProposedChange] ✅ File written successfully");
    console.log("[acceptProposedChange] Path:", resolvedPath);
    console.log("[acceptProposedChange] Bytes written:", bytesWritten);

    // Revalidate the cache to ensure fresh data on next read
    // This purges the Next.js Data Cache for this path
    revalidatePath("/");
    
    return {
      success: true,
      bytesWritten,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[acceptProposedChange] ❌ Error:", errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Read the current content of a file (for diff comparison)
 * Uses the same security checks as other file operations
 */
export async function getCurrentFileContent(
  filePath: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const settings = await readSettings();

    // Security: ensure the file is within the root directory
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(settings.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return {
        success: false,
        error: "Access denied: File is outside the allowed directory",
      };
    }

    const content = await fs.readFile(resolvedPath, "utf-8");
    
    return {
      success: true,
      content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}
