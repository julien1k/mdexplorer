"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Command } from "cmdk";
import { useAppStore } from "@/stores/app-store";
import { searchFiles, createMarkdownFile, getRootDirectory, readFile } from "@/actions/file-actions";
import { updateSetting, validateDirectory } from "@/actions/settings-actions";
import { getValidRecentFiles } from "@/actions/recent-files-actions";
import { isMarkdownFile } from "@/lib/config";
import type { FileNode, RecentFile } from "@/types";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  Save,
  FilePlus,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  File,
  X,
  Settings,
  FolderOpen,
  Loader2,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";

type CommandMode = "commands" | "search" | "newfile" | "switchroot" | "recent";

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setIsSettingsModalOpen,
    setActiveFile,
    setEditorContent,
    setIsDirty,
    triggerRefresh,
    expandAll,
    collapseAll,
    settings,
    setSettings,
    recentFiles,
    setRecentFiles,
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<CommandMode>("commands");
  const [newFileName, setNewFileName] = useState("");
  const [newRootPath, setNewRootPath] = useState("");
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValidation, setPathValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle command palette with Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
        setMode("commands");
        setSearch("");
      }

      // Close on escape
      if (e.key === "Escape" && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        setMode("commands");
        setSearch("");
      }

      // Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const save = (window as unknown as { __mdexplorer_save?: () => void }).__mdexplorer_save;
        if (save) save();
      }

      // Ctrl+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        setIsSettingsModalOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen, setIsSettingsModalOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isCommandPaletteOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isCommandPaletteOpen, mode]);

  // Search files when in search mode
  useEffect(() => {
    if (mode === "search" && search.length > 0) {
      setIsSearching(true);
      const searchTimer = setTimeout(async () => {
        const results = await searchFiles(search);
        setSearchResults(results.slice(0, 10));
        setIsSearching(false);
      }, 200);
      return () => clearTimeout(searchTimer);
    } else {
      setSearchResults([]);
    }
  }, [search, mode]);

  // Validate path when in switchroot mode
  useEffect(() => {
    if (mode === "switchroot" && newRootPath.trim()) {
      setIsValidatingPath(true);
      const timer = setTimeout(async () => {
        const result = await validateDirectory(newRootPath);
        setPathValidation(result);
        setIsValidatingPath(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPathValidation(null);
    }
  }, [newRootPath, mode]);

  const handleToggleHeadings = useCallback(() => {
    const toggle = (window as unknown as { __mdexplorer_toggleHeadings?: () => void }).__mdexplorer_toggleHeadings;
    if (toggle) toggle();
    setIsCommandPaletteOpen(false);
  }, [setIsCommandPaletteOpen]);

  const handleSaveFile = useCallback(() => {
    const save = (window as unknown as { __mdexplorer_save?: () => void }).__mdexplorer_save;
    if (save) save();
    setIsCommandPaletteOpen(false);
  }, [setIsCommandPaletteOpen]);

  const handleSearchFiles = useCallback(() => {
    setMode("search");
    setSearch("");
  }, []);

  const handleNewFile = useCallback(() => {
    setMode("newfile");
    setNewFileName("");
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setIsSettingsModalOpen(true);
  }, [setIsCommandPaletteOpen, setIsSettingsModalOpen]);

  const handleSwitchRoot = useCallback(() => {
    setMode("switchroot");
    setNewRootPath(settings.rootDirectory);
    setPathValidation(null);
  }, [settings.rootDirectory]);

  const handleOpenRecent = useCallback(async () => {
    setMode("recent");
    setIsLoadingRecent(true);
    try {
      const recent = await getValidRecentFiles();
      setRecentFiles(recent);
    } catch (error) {
      console.error("Failed to load recent files:", error);
    }
    setIsLoadingRecent(false);
  }, [setRecentFiles]);

  const handleSelectRecentFile = useCallback(async (recentFile: RecentFile) => {
    try {
      const content = await readFile(recentFile.path);
      setActiveFile(recentFile.path);
      setEditorContent(content);
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to open recent file:", error);
      alert("Failed to open file. It may have been moved or deleted.");
    }
    setIsCommandPaletteOpen(false);
    setMode("commands");
  }, [setActiveFile, setEditorContent, setIsDirty, setIsCommandPaletteOpen]);

  const handleSelectFile = useCallback(async (file: FileNode) => {
    if (file.type === "file" && isMarkdownFile(file.name)) {
      const content = await readFile(file.path);
      setActiveFile(file.path);
      setEditorContent(content);
      setIsDirty(false);
    }
    setIsCommandPaletteOpen(false);
    setMode("commands");
    setSearch("");
  }, [setActiveFile, setEditorContent, setIsDirty, setIsCommandPaletteOpen]);

  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) return;

    const rootDir = await getRootDirectory();
    const result = await createMarkdownFile(rootDir, newFileName.trim());

    if (result.success && result.filePath) {
      triggerRefresh();
      // Open the new file
      const content = await readFile(result.filePath);
      setActiveFile(result.filePath);
      setEditorContent(content);
      setIsDirty(false);
    }

    setIsCommandPaletteOpen(false);
    setMode("commands");
    setNewFileName("");
  }, [newFileName, triggerRefresh, setActiveFile, setEditorContent, setIsDirty, setIsCommandPaletteOpen]);

  const handleConfirmSwitchRoot = useCallback(async () => {
    if (!newRootPath.trim() || !pathValidation?.valid) return;

    const result = await updateSetting("rootDirectory", newRootPath.trim());
    
    if (result.success && result.settings) {
      setSettings(result.settings);
      setActiveFile(null);
      setEditorContent("");
      triggerRefresh();
    }

    setIsCommandPaletteOpen(false);
    setMode("commands");
    setNewRootPath("");
  }, [newRootPath, pathValidation, setSettings, setActiveFile, setEditorContent, triggerRefresh, setIsCommandPaletteOpen]);

  const resetAndClose = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setMode("commands");
    setSearch("");
    setNewFileName("");
    setNewRootPath("");
    setPathValidation(null);
  }, [setIsCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={resetAndClose}
      />

      {/* Command palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl">
        <Command className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Search className="h-4 w-4 text-gray-400" />
            {mode === "newfile" ? (
              <input
                ref={inputRef}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                }}
                placeholder="Enter file name (e.g., my-notes.md)"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
            ) : mode === "switchroot" ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={newRootPath}
                  onChange={(e) => setNewRootPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pathValidation?.valid) handleConfirmSwitchRoot();
                  }}
                  placeholder="Enter directory path (e.g., C:\Users\Documents)"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
                />
                {isValidatingPath ? (
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                ) : pathValidation?.valid ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : pathValidation?.valid === false ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : null}
              </div>
            ) : (
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder={
                  mode === "search"
                    ? "Search files..."
                    : "Type a command or search..."
                }
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
            )}
            <button
              onClick={resetAndClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {mode === "commands" && (
              <>
                <Command.Empty className="py-6 text-center text-sm text-gray-500">
                  No commands found.
                </Command.Empty>

                <Command.Group heading="Actions" className="text-xs text-gray-500 px-2 py-1.5">
                  <Command.Item
                    onSelect={handleSaveFile}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <Save className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Save File</span>
                    <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      Ctrl+S
                    </kbd>
                  </Command.Item>

                  <Command.Item
                    onSelect={handleOpenRecent}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Open Recent</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={handleToggleHeadings}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Toggle All Headings</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={handleSearchFiles}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <Search className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Search Files</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={handleNewFile}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <FilePlus className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">New Markdown File</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Navigation" className="text-xs text-gray-500 px-2 py-1.5 mt-2">
                  <Command.Item
                    onSelect={handleSwitchRoot}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <FolderOpen className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Switch Root Directory</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      expandAll();
                      setIsCommandPaletteOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Expand All Folders</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      collapseAll();
                      setIsCommandPaletteOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Collapse All Folders</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Settings" className="text-xs text-gray-500 px-2 py-1.5 mt-2">
                  <Command.Item
                    onSelect={handleOpenSettings}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Open Settings</span>
                    <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      Ctrl+,
                    </kbd>
                  </Command.Item>
                </Command.Group>
              </>
            )}

            {mode === "search" && (
              <>
                {isSearching ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    Searching...
                  </div>
                ) : searchResults.length === 0 && search ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No files found.
                  </div>
                ) : (
                  searchResults.map((file) => (
                    <Command.Item
                      key={file.path}
                      value={file.path}
                      onSelect={() => handleSelectFile(file)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                    >
                      {file.type === "directory" ? (
                        <Folder className="h-4 w-4 text-amber-500" />
                      ) : isMarkdownFile(file.name) ? (
                        <FileText className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-400" />
                      )}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 truncate">
                          {file.path}
                        </span>
                      </div>
                    </Command.Item>
                  ))
                )}
              </>
            )}

            {mode === "newfile" && (
              <div className="px-3 py-4">
                <p className="text-sm text-gray-500 mb-3">
                  Enter a name for your new markdown file:
                </p>
                <button
                  onClick={handleCreateFile}
                  disabled={!newFileName.trim()}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  Create File
                </button>
              </div>
            )}

            {mode === "switchroot" && (
              <div className="px-3 py-4">
                <p className="text-sm text-gray-500 mb-2">
                  Enter the path to your documents folder:
                </p>
                {pathValidation?.error && (
                  <p className="text-xs text-red-500 mb-3">{pathValidation.error}</p>
                )}
                <p className="text-xs text-gray-400 mb-3">
                  Current: {settings.rootDirectory}
                </p>
                <button
                  onClick={handleConfirmSwitchRoot}
                  disabled={!newRootPath.trim() || !pathValidation?.valid}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  Switch Directory
                </button>
              </div>
            )}

            {mode === "recent" && (
              <>
                {isLoadingRecent ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading recent files...
                  </div>
                ) : recentFiles.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No recent files yet.</p>
                    <p className="text-xs mt-1">Files you open or save will appear here.</p>
                  </div>
                ) : (
                  <Command.Group heading="Recent Files" className="text-xs text-gray-500 px-2 py-1.5">
                    {recentFiles.map((file) => (
                      <Command.Item
                        key={`${file.path}-${file.timestamp}`}
                        value={file.path}
                        onSelect={() => handleSelectRecentFile(file)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                      >
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-gray-400 truncate">
                            {file.path}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDistanceToNow(file.timestamp, { addSuffix: true })}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd> Close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
