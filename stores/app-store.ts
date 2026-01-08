"use client";

import { create } from "zustand";
import type { FileNode, AppSettings, RecentFile, ContextMenuState, PendingChange, ToolPermissionRequest } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

interface AppState {
  // Settings
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  isSettingsLoaded: boolean;
  setSettingsLoaded: (loaded: boolean) => void;

  // File tree state
  files: FileNode[];
  setFiles: (files: FileNode[]) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Selected folder for creating new files/folders
  selectedFolder: string | null;
  setSelectedFolder: (path: string | null) => void;

  // Active file state
  activeFile: string | null;
  setActiveFile: (path: string | null) => void;

  // Editor state
  editorContent: string;
  setEditorContent: (content: string) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  /** Version counter to force editor re-render when AI updates the document */
  editorVersion: number;
  incrementEditorVersion: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: FileNode[];
  setSearchResults: (results: FileNode[]) => void;

  // UI state
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  isChatPanelOpen: boolean;
  setIsChatPanelOpen: (open: boolean) => void;

  // AI Copilot state
  selectedText: string;
  setSelectedText: (text: string) => void;

  // Context menu state
  contextMenu: ContextMenuState;
  openContextMenu: (x: number, y: number, node: FileNode) => void;
  closeContextMenu: () => void;

  // Delete confirmation dialog
  deleteConfirmation: { isOpen: boolean; node: FileNode | null };
  openDeleteConfirmation: (node: FileNode) => void;
  closeDeleteConfirmation: () => void;

  // Rename state
  renamingNode: FileNode | null;
  setRenamingNode: (node: FileNode | null) => void;

  // Creating new item state
  creatingItem: { type: "file" | "folder"; parentPath: string } | null;
  setCreatingItem: (item: { type: "file" | "folder"; parentPath: string } | null) => void;

  // Recent files
  recentFiles: RecentFile[];
  setRecentFiles: (files: RecentFile[]) => void;

  // Refresh trigger
  refreshTrigger: number;
  triggerRefresh: () => void;

  // Pending AI change (diff workflow)
  pendingChange: PendingChange | null;
  setPendingChange: (change: PendingChange | null) => void;
  clearPendingChange: () => void;

  // Tool permission requests
  toolPermissionRequest: ToolPermissionRequest | null;
  setToolPermissionRequest: (request: ToolPermissionRequest | null) => void;
  clearToolPermissionRequest: () => void;
}

// Helper to get all folder paths recursively
function getAllFolderPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === "directory") {
        paths.push(item.path);
        if (item.children) {
          traverse(item.children);
        }
      }
    }
  };
  traverse(nodes);
  return paths;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Settings
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
  isSettingsLoaded: false,
  setSettingsLoaded: (loaded) => set({ isSettingsLoaded: loaded }),

  // File tree state
  files: [],
  setFiles: (files) => set({ files }),
  expandedFolders: new Set(),
  toggleFolder: (path) =>
    set((state) => {
      const next = new Set(state.expandedFolders);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedFolders: next };
    }),
  expandAll: () =>
    set((state) => ({
      expandedFolders: new Set(getAllFolderPaths(state.files)),
    })),
  collapseAll: () => set({ expandedFolders: new Set() }),

  // Active file state
  activeFile: null,
  setActiveFile: (path) => set({ activeFile: path }),

  // Editor state
  editorContent: "",
  setEditorContent: (content) => set({ editorContent: content }),
  isDirty: false,
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  editorVersion: 0,
  incrementEditorVersion: () =>
    set((state) => ({ editorVersion: state.editorVersion + 1 })),

  // Search state
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),

  // UI state
  isCommandPaletteOpen: false,
  setIsCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  isChatPanelOpen: false,
  setIsChatPanelOpen: (open) => set({ isChatPanelOpen: open }),

  // AI Copilot state
  selectedText: "",
  setSelectedText: (text) => set({ selectedText: text }),

  // Context menu state
  contextMenu: { isOpen: false, x: 0, y: 0, targetNode: null },
  openContextMenu: (x, y, node) =>
    set({ contextMenu: { isOpen: true, x, y, targetNode: node } }),
  closeContextMenu: () =>
    set({ contextMenu: { isOpen: false, x: 0, y: 0, targetNode: null } }),

  // Delete confirmation
  deleteConfirmation: { isOpen: false, node: null },
  openDeleteConfirmation: (node) =>
    set({ deleteConfirmation: { isOpen: true, node } }),
  closeDeleteConfirmation: () =>
    set({ deleteConfirmation: { isOpen: false, node: null } }),

  // Rename state
  renamingNode: null,
  setRenamingNode: (node) => set({ renamingNode: node }),

  // Creating new item state
  creatingItem: null,
  setCreatingItem: (item) => set({ creatingItem: item }),

  // Selected folder
  selectedFolder: null,
  setSelectedFolder: (path) => set({ selectedFolder: path }),

  // Recent files
  recentFiles: [],
  setRecentFiles: (files) => set({ recentFiles: files }),

  // Refresh trigger
  refreshTrigger: 0,
  triggerRefresh: () =>
    set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),

  // Pending AI change (diff workflow)
  pendingChange: null,
  setPendingChange: (change) => set({ pendingChange: change }),
  clearPendingChange: () => set({ pendingChange: null }),

  // Tool permission requests
  toolPermissionRequest: null,
  setToolPermissionRequest: (request) => set({ toolPermissionRequest: request }),
  clearToolPermissionRequest: () => set({ toolPermissionRequest: null }),
}));

// Hook for backward compatibility with existing code
export function useFileExplorer() {
  return useAppStore();
}
