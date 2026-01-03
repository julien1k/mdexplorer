"use server";

import fs from "fs/promises";
import path from "path";
import type { RecentFile } from "@/types";

const MAX_RECENT_FILES = 20;
const RECENT_FILES_PATH = path.join(process.cwd(), "recent_files.json");

/**
 * Read the recent files list
 */
export async function getRecentFiles(): Promise<RecentFile[]> {
  try {
    const content = await fs.readFile(RECENT_FILES_PATH, "utf-8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    // File doesn't exist or is invalid
    return [];
  }
}

/**
 * Add a file to the recent files list
 * Tracks both open and save actions
 */
export async function addRecentFile(
  filePath: string,
  action: "open" | "save"
): Promise<{ success: boolean; error?: string }> {
  try {
    const recentFiles = await getRecentFiles();
    const fileName = path.basename(filePath);

    // Create new entry
    const newEntry: RecentFile = {
      path: filePath,
      name: fileName,
      timestamp: Date.now(),
      action,
    };

    // Remove existing entry for the same path (if exists)
    const filtered = recentFiles.filter((f) => f.path !== filePath);

    // Add new entry at the beginning
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_FILES);

    // Write back to file
    await fs.writeFile(RECENT_FILES_PATH, JSON.stringify(updated, null, 2), "utf-8");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Remove a file from the recent files list
 * (useful when a file is deleted)
 */
export async function removeRecentFile(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const recentFiles = await getRecentFiles();
    const filtered = recentFiles.filter((f) => f.path !== filePath);

    await fs.writeFile(RECENT_FILES_PATH, JSON.stringify(filtered, null, 2), "utf-8");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear all recent files
 */
export async function clearRecentFiles(): Promise<{ success: boolean; error?: string }> {
  try {
    await fs.writeFile(RECENT_FILES_PATH, JSON.stringify([], null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get recent files filtered to only include files that still exist
 */
export async function getValidRecentFiles(): Promise<RecentFile[]> {
  const recentFiles = await getRecentFiles();
  const validFiles: RecentFile[] = [];

  for (const file of recentFiles) {
    try {
      await fs.access(file.path);
      validFiles.push(file);
    } catch {
      // File no longer exists, skip it
    }
  }

  // If we removed some invalid files, update the stored list
  if (validFiles.length !== recentFiles.length) {
    await fs.writeFile(RECENT_FILES_PATH, JSON.stringify(validFiles, null, 2), "utf-8");
  }

  return validFiles;
}
