"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { FileNode } from "@/types";

interface FileExplorerContextType {
  // File tree state
  files: FileNode[];
  setFiles: (files: FileNode[]) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  
  // Active file state
  activeFile: string | null;
  setActiveFile: (path: string | null) => void;
  
  // Editor state
  editorContent: string;
  setEditorContent: (content: string) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  
  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: FileNode[];
  setSearchResults: (results: FileNode[]) => void;
  
  // Command palette
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  
  // Refresh trigger
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const FileExplorerContext = createContext<FileExplorerContextType | undefined>(undefined);

export function FileExplorerProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<FileNode[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const getAllFolderPaths = useCallback((nodes: FileNode[]): string[] => {
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
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = getAllFolderPaths(files);
    setExpandedFolders(new Set(allPaths));
  }, [files, getAllFolderPaths]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <FileExplorerContext.Provider
      value={{
        files,
        setFiles,
        expandedFolders,
        toggleFolder,
        expandAll,
        collapseAll,
        activeFile,
        setActiveFile,
        editorContent,
        setEditorContent,
        isDirty,
        setIsDirty,
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  );
}

export function useFileExplorer() {
  const context = useContext(FileExplorerContext);
  if (context === undefined) {
    throw new Error("useFileExplorer must be used within a FileExplorerProvider");
  }
  return context;
}
