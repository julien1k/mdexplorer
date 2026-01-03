"use client";

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useAppStore } from "@/stores/app-store";
import { acceptProposedChange } from "@/actions/ai-change-actions";
import { readFile } from "@/actions/file-actions";
import {
  Check,
  X,
  GitCompare,
  Loader2,
  FileEdit,
  SplitSquareHorizontal,
  AlignJustify,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "split" | "unified";

// Custom styles for the diff viewer
const diffStyles = {
  variables: {
    light: {
      diffViewerBackground: "#ffffff",
      diffViewerColor: "#1f2937",
      addedBackground: "#dcfce7",
      addedColor: "#166534",
      removedBackground: "#fee2e2",
      removedColor: "#991b1b",
      wordAddedBackground: "#bbf7d0",
      wordRemovedBackground: "#fecaca",
      addedGutterBackground: "#bbf7d0",
      removedGutterBackground: "#fecaca",
      gutterBackground: "#f9fafb",
      gutterBackgroundDark: "#f3f4f6",
      highlightBackground: "#fef3c7",
      highlightGutterBackground: "#fef3c7",
      codeFoldGutterBackground: "#f3f4f6",
      codeFoldBackground: "#f9fafb",
      emptyLineBackground: "#f9fafb",
      gutterColor: "#6b7280",
      addedGutterColor: "#166534",
      removedGutterColor: "#991b1b",
      codeFoldContentColor: "#6b7280",
      diffViewerTitleBackground: "#f3f4f6",
      diffViewerTitleColor: "#1f2937",
      diffViewerTitleBorderColor: "#e5e7eb",
    },
    dark: {
      diffViewerBackground: "#1f2937",
      diffViewerColor: "#f3f4f6",
      addedBackground: "#064e3b",
      addedColor: "#a7f3d0",
      removedBackground: "#7f1d1d",
      removedColor: "#fecaca",
      wordAddedBackground: "#065f46",
      wordRemovedBackground: "#991b1b",
      addedGutterBackground: "#064e3b",
      removedGutterBackground: "#7f1d1d",
      gutterBackground: "#111827",
      gutterBackgroundDark: "#1f2937",
      highlightBackground: "#78350f",
      highlightGutterBackground: "#78350f",
      codeFoldGutterBackground: "#1f2937",
      codeFoldBackground: "#111827",
      emptyLineBackground: "#111827",
      gutterColor: "#9ca3af",
      addedGutterColor: "#a7f3d0",
      removedGutterColor: "#fecaca",
      codeFoldContentColor: "#9ca3af",
      diffViewerTitleBackground: "#111827",
      diffViewerTitleColor: "#f3f4f6",
      diffViewerTitleBorderColor: "#374151",
    },
  },
  line: {
    padding: "4px 8px",
    fontSize: "13px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  gutter: {
    padding: "0 8px",
    minWidth: "40px",
  },
  contentText: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};

interface DiffReviewPanelProps {
  onAccepted?: () => void;
  onRejected?: () => void;
}

export function DiffReviewPanel({ onAccepted, onRejected }: DiffReviewPanelProps) {
  const {
    pendingChange,
    clearPendingChange,
    setEditorContent,
    setIsDirty,
    incrementEditorVersion,
    editorContent,
  } = useAppStore();

  const [isAccepting, setIsAccepting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Handle accepting the proposed changes
  const handleAccept = useCallback(async () => {
    if (!pendingChange) return;

    setIsAccepting(true);

    try {
      const result = await acceptProposedChange(
        pendingChange.filePath,
        pendingChange.proposedContent
      );

      if (result.success) {
        console.log("[DiffReviewPanel] Changes accepted and written to disk");
        console.log("[DiffReviewPanel] Bytes written:", result.bytesWritten);

        // OPTIMISTIC UPDATE: Update the editor state with the new content immediately
        // This becomes the new "source of truth" for the editor and future diff comparisons
        const newContent = pendingChange.proposedContent;
        
        // 1. Update the global editor content state (this is the source of truth)
        setEditorContent(newContent);
        console.log("[DiffReviewPanel] Updated editorContent in store (length:", newContent.length, ")");
        
        // 2. Mark as not dirty since we just saved
        setIsDirty(false);
        
        // 3. Force editor to re-render with the new content
        incrementEditorVersion();

        // 4. Clear the pending change AFTER updating content
        // This resets the UI for the next AI request
        clearPendingChange();
        console.log("[DiffReviewPanel] Cleared pending change - ready for next request");

        // 5. Notify parent (triggers file tree refresh if needed)
        onAccepted?.();
      } else {
        console.error("[DiffReviewPanel] Failed to accept changes:", result.error);
        alert(`Failed to save changes: ${result.error}`);
      }
    } catch (error) {
      console.error("[DiffReviewPanel] Error accepting changes:", error);
      alert("An unexpected error occurred while saving changes");
    } finally {
      setIsAccepting(false);
    }
  }, [
    pendingChange,
    clearPendingChange,
    setEditorContent,
    setIsDirty,
    incrementEditorVersion,
    onAccepted,
  ]);

  // Handle rejecting the proposed changes
  const handleReject = useCallback(() => {
    console.log("[DiffReviewPanel] Changes rejected by user");
    clearPendingChange();
    onRejected?.();
  }, [clearPendingChange, onRejected]);

  // Don't render if there's no pending change
  if (!pendingChange) {
    return null;
  }

  // Use the stored original content or fall back to current editor content
  const originalContent = pendingChange.originalContent || editorContent;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <GitCompare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                Review AI Changes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingChange.summary}
              </p>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  viewMode === "split"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <SplitSquareHorizontal className="h-4 w-4" />
                Split
              </button>
              <button
                onClick={() => setViewMode("unified")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  viewMode === "unified"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <AlignJustify className="h-4 w-4" />
                Unified
              </button>
            </div>
          </div>
        </div>

        {/* File path indicator */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FileEdit className="h-4 w-4" />
            <span className="font-mono">
              {pendingChange.filePath.split(/[\\/]/).pop()}
            </span>
            <span className="text-gray-400 dark:text-gray-500">
              ({pendingChange.proposedContent.length} characters)
            </span>
          </div>
        </div>

        {/* Diff viewer */}
        <div className="flex-1 overflow-auto">
          <ReactDiffViewer
            oldValue={originalContent}
            newValue={pendingChange.proposedContent}
            splitView={viewMode === "split"}
            useDarkTheme={
              typeof window !== "undefined" &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
            }
            leftTitle="Original"
            rightTitle="Proposed Changes"
            styles={diffStyles}
            compareMethod={DiffMethod.WORDS}
            showDiffOnly={false}
            extraLinesSurroundingDiff={3}
          />
        </div>

        {/* Action buttons - floating bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="sticky bottom-0 px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review the changes above before accepting or rejecting
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={isAccepting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject Changes
              </button>
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Accept Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
