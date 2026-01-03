"use server";

import fs from "fs/promises";
import path from "path";
import type { AppSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

/**
 * Read settings from the settings.json file
 */
export async function readSettings(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(content) as Partial<AppSettings>;
    
    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      // If rootDirectory is empty, use the default documents folder
      rootDirectory: settings.rootDirectory || path.join(process.cwd(), "documents"),
    };
  } catch {
    // File doesn't exist or is invalid, return defaults with documents folder
    const defaultWithRoot = {
      ...DEFAULT_SETTINGS,
      rootDirectory: path.join(process.cwd(), "documents"),
    };
    
    // Create the settings file with defaults
    await writeSettings(defaultWithRoot);
    return defaultWithRoot;
  }
}

/**
 * Write settings to the settings.json file
 */
export async function writeSettings(settings: AppSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(SETTINGS_FILE, content, "utf-8");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update a single setting
 */
export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<{ success: boolean; settings?: AppSettings; error?: string }> {
  try {
    const currentSettings = await readSettings();
    const newSettings = { ...currentSettings, [key]: value };
    const result = await writeSettings(newSettings);
    
    if (result.success) {
      return { success: true, settings: newSettings };
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate that a directory exists and is accessible
 */
export async function validateDirectory(dirPath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const resolvedPath = path.resolve(dirPath);
    const stats = await fs.stat(resolvedPath);
    
    if (!stats.isDirectory()) {
      return { valid: false, error: "Path is not a directory" };
    }
    
    // Try to read the directory to ensure we have access
    await fs.readdir(resolvedPath);
    return { valid: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { valid: false, error: "Directory does not exist" };
    }
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return { valid: false, error: "Permission denied" };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the current root directory (from settings)
 */
export async function getCurrentRootDirectory(): Promise<string> {
  const settings = await readSettings();
  return settings.rootDirectory;
}
