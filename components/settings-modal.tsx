"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { writeSettings, validateDirectory } from "@/actions/settings-actions";
import {
  X,
  FolderOpen,
  Settings,
  FileX,
  FolderX,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settings,
    setSettings,
    triggerRefresh,
  } = useAppStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [newExtension, setNewExtension] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Sync local settings when modal opens or settings change
  useEffect(() => {
    if (isSettingsModalOpen) {
      setLocalSettings(settings);
      setValidationStatus(null);
    }
  }, [isSettingsModalOpen, settings]);

  // Validate directory when it changes
  const handleDirectoryChange = useCallback(async (dir: string) => {
    setLocalSettings((prev) => ({ ...prev, rootDirectory: dir }));
    
    if (dir.trim()) {
      setIsValidating(true);
      const result = await validateDirectory(dir);
      setValidationStatus(result);
      setIsValidating(false);
    } else {
      setValidationStatus(null);
    }
  }, []);

  const handleAddExtension = useCallback(() => {
    if (!newExtension.trim()) return;
    
    let ext = newExtension.trim().toLowerCase();
    if (!ext.startsWith(".")) {
      ext = "." + ext;
    }
    
    if (!localSettings.excludedExtensions.includes(ext)) {
      setLocalSettings((prev) => ({
        ...prev,
        excludedExtensions: [...prev.excludedExtensions, ext],
      }));
    }
    setNewExtension("");
  }, [newExtension, localSettings.excludedExtensions]);

  const handleRemoveExtension = useCallback((ext: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      excludedExtensions: prev.excludedExtensions.filter((e) => e !== ext),
    }));
  }, []);

  const handleAddFolder = useCallback(() => {
    if (!newFolder.trim()) return;
    
    const folder = newFolder.trim();
    
    if (!localSettings.excludedFolders.includes(folder)) {
      setLocalSettings((prev) => ({
        ...prev,
        excludedFolders: [...prev.excludedFolders, folder],
      }));
    }
    setNewFolder("");
  }, [newFolder, localSettings.excludedFolders]);

  const handleRemoveFolder = useCallback((folder: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      excludedFolders: prev.excludedFolders.filter((f) => f !== folder),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (validationStatus && !validationStatus.valid) {
      return;
    }

    setIsSaving(true);
    const result = await writeSettings(localSettings);
    
    if (result.success) {
      setSettings(localSettings);
      triggerRefresh();
      setIsSettingsModalOpen(false);
    } else {
      console.error("Failed to save settings:", result.error);
    }
    
    setIsSaving(false);
  }, [localSettings, validationStatus, setSettings, triggerRefresh, setIsSettingsModalOpen]);

  const handleCancel = useCallback(() => {
    setLocalSettings(settings);
    setIsSettingsModalOpen(false);
  }, [settings, setIsSettingsModalOpen]);

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-130px)] space-y-6">
            {/* Root Directory */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <FolderOpen className="h-4 w-4 inline mr-2" />
                Root Directory
              </label>
              <p className="text-xs text-gray-500 mb-2">
                The base folder for browsing and editing files.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={localSettings.rootDirectory}
                  onChange={(e) => handleDirectoryChange(e.target.value)}
                  placeholder="C:\Users\Documents\Notes"
                  className={cn(
                    "w-full px-3 py-2 pr-10 rounded-lg border text-sm",
                    "bg-white dark:bg-gray-800 outline-none transition-colors",
                    validationStatus?.valid === false
                      ? "border-red-500 focus:border-red-500"
                      : validationStatus?.valid === true
                      ? "border-green-500 focus:border-green-500"
                      : "border-gray-200 dark:border-gray-700 focus:border-blue-500"
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                  ) : validationStatus?.valid === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : validationStatus?.valid === false ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : null}
                </div>
              </div>
              {validationStatus?.error && (
                <p className="text-xs text-red-500 mt-1">{validationStatus.error}</p>
              )}
            </div>

            {/* Excluded Extensions */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <FileX className="h-4 w-4 inline mr-2" />
                Excluded File Extensions
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Files with these extensions will be hidden from the file tree and search.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {localSettings.excludedExtensions.map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm"
                  >
                    {ext}
                    <button
                      onClick={() => handleRemoveExtension(ext)}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExtension}
                  onChange={(e) => setNewExtension(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddExtension()}
                  placeholder=".exe"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddExtension}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Excluded Folders */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <FolderX className="h-4 w-4 inline mr-2" />
                Excluded Folders
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Folders with these names will be hidden from the file tree and search.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {localSettings.excludedFolders.map((folder) => (
                  <span
                    key={folder}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm"
                  >
                    {folder}
                    <button
                      onClick={() => handleRemoveFolder(folder)}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                  placeholder="node_modules"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddFolder}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (validationStatus?.valid === false)}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
