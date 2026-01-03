"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { getPathForClipboard, duplicateFile } from "@/actions/file-management-actions";
import { isMarkdownFile } from "@/lib/config";
import {
  Edit2,
  Trash2,
  Copy,
  FolderInput,
  FilePlus,
  FolderPlus,
  ExternalLink,
  FileText,
} from "lucide-react";

export function ContextMenu() {
  const {
    contextMenu,
    closeContextMenu,
    openDeleteConfirmation,
    setRenamingNode,
    setCreatingItem,
    triggerRefresh,
  } = useAppStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const { isOpen, x, y, targetNode } = contextMenu;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeContextMenu]);

  const handleRename = useCallback(() => {
    if (targetNode) {
      setRenamingNode(targetNode);
    }
    closeContextMenu();
  }, [targetNode, setRenamingNode, closeContextMenu]);

  const handleDelete = useCallback(() => {
    if (targetNode) {
      openDeleteConfirmation(targetNode);
    }
    closeContextMenu();
  }, [targetNode, openDeleteConfirmation, closeContextMenu]);

  const handleCopyPath = useCallback(async () => {
    if (targetNode) {
      const result = await getPathForClipboard(targetNode.path, false);
      if (result.success && result.path) {
        await navigator.clipboard.writeText(result.path);
      }
    }
    closeContextMenu();
  }, [targetNode, closeContextMenu]);

  const handleCopyRelativePath = useCallback(async () => {
    if (targetNode) {
      const result = await getPathForClipboard(targetNode.path, true);
      if (result.success && result.path) {
        await navigator.clipboard.writeText(result.path);
      }
    }
    closeContextMenu();
  }, [targetNode, closeContextMenu]);

  const handleDuplicate = useCallback(async () => {
    if (targetNode && targetNode.type === "file") {
      const result = await duplicateFile(targetNode.path);
      if (result.success) {
        triggerRefresh();
      }
    }
    closeContextMenu();
  }, [targetNode, triggerRefresh, closeContextMenu]);

  const handleNewFile = useCallback(() => {
    if (targetNode) {
      const parentPath = targetNode.type === "directory" 
        ? targetNode.path 
        : targetNode.path.substring(0, targetNode.path.lastIndexOf("\\"));
      setCreatingItem({ type: "file", parentPath });
    }
    closeContextMenu();
  }, [targetNode, setCreatingItem, closeContextMenu]);

  const handleNewFolder = useCallback(() => {
    if (targetNode) {
      const parentPath = targetNode.type === "directory" 
        ? targetNode.path 
        : targetNode.path.substring(0, targetNode.path.lastIndexOf("\\"));
      setCreatingItem({ type: "folder", parentPath });
    }
    closeContextMenu();
  }, [targetNode, setCreatingItem, closeContextMenu]);

  if (!isOpen || !targetNode) return null;

  const isDirectory = targetNode.type === "directory";
  const isMarkdown = !isDirectory && isMarkdownFile(targetNode.name);

  // Adjust position to stay in viewport
  const menuWidth = 200;
  const menuHeight = 300;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* New file/folder options (only for directories or showing parent context) */}
      <MenuItem icon={<FilePlus className="h-4 w-4" />} onClick={handleNewFile}>
        New File
      </MenuItem>
      <MenuItem icon={<FolderPlus className="h-4 w-4" />} onClick={handleNewFolder}>
        New Folder
      </MenuItem>

      <MenuDivider />

      {/* Rename */}
      <MenuItem icon={<Edit2 className="h-4 w-4" />} onClick={handleRename}>
        Rename
      </MenuItem>

      {/* Duplicate (only for files) */}
      {!isDirectory && (
        <MenuItem icon={<FileText className="h-4 w-4" />} onClick={handleDuplicate}>
          Duplicate
        </MenuItem>
      )}

      <MenuDivider />

      {/* Copy path options */}
      <MenuItem icon={<Copy className="h-4 w-4" />} onClick={handleCopyPath}>
        Copy Path
      </MenuItem>
      <MenuItem icon={<FolderInput className="h-4 w-4" />} onClick={handleCopyRelativePath}>
        Copy Relative Path
      </MenuItem>

      <MenuDivider />

      {/* Delete */}
      <MenuItem
        icon={<Trash2 className="h-4 w-4" />}
        onClick={handleDelete}
        danger
      >
        Delete
      </MenuItem>
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

function MenuItem({ icon, onClick, children, danger, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
        transition-colors
        ${disabled 
          ? "text-gray-400 cursor-not-allowed" 
          : danger
            ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-gray-200 dark:border-gray-700" />;
}
