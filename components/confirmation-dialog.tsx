"use client";

import React, { useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { deleteItem } from "@/actions/file-management-actions";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmationDialog() {
  const {
    deleteConfirmation,
    closeDeleteConfirmation,
    triggerRefresh,
    activeFile,
    setActiveFile,
    setEditorContent,
  } = useAppStore();

  const { isOpen, node } = deleteConfirmation;

  const handleDelete = useCallback(async () => {
    if (!node) return;

    const result = await deleteItem(node.path, true);
    
    if (result.success) {
      // If we deleted the active file, clear the editor
      if (activeFile === node.path) {
        setActiveFile(null);
        setEditorContent("");
      }
      triggerRefresh();
    } else {
      console.error("Failed to delete:", result.error);
      alert(`Failed to delete: ${result.error}`);
    }

    closeDeleteConfirmation();
  }, [node, activeFile, setActiveFile, setEditorContent, triggerRefresh, closeDeleteConfirmation]);

  const handlePermanentDelete = useCallback(async () => {
    if (!node) return;

    const result = await deleteItem(node.path, false);
    
    if (result.success) {
      if (activeFile === node.path) {
        setActiveFile(null);
        setEditorContent("");
      }
      triggerRefresh();
    } else {
      console.error("Failed to delete:", result.error);
      alert(`Failed to delete: ${result.error}`);
    }

    closeDeleteConfirmation();
  }, [node, activeFile, setActiveFile, setEditorContent, triggerRefresh, closeDeleteConfirmation]);

  if (!isOpen || !node) return null;

  const isDirectory = node.type === "directory";
  const itemType = isDirectory ? "folder" : "file";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeDeleteConfirmation}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Delete {itemType}</h2>
          </div>
          <button
            onClick={closeDeleteConfirmation}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Are you sure you want to delete this {itemType}?
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {node.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
              {node.path}
            </p>
          </div>

          {isDirectory && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">
              ⚠️ This will delete all files and subfolders inside this folder.
            </p>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-500">
            The item will be moved to the system trash if possible.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={closeDeleteConfirmation}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}
