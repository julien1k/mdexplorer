"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { FileTree } from "@/components/file-tree";
import { CommandPalette } from "@/components/command-palette";
import { SettingsModal } from "@/components/settings-modal";
import { ContextMenu } from "@/components/context-menu";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { ChatPanel } from "@/components/chat-panel";
import { DiffReviewPanel } from "@/components/diff-review-panel";
import { useAppStore } from "@/stores/app-store";
import { readSettings } from "@/actions/settings-actions";
import { PanelLeftClose, PanelLeftOpen, Command, Settings, Loader2, Sparkles, PanelRightClose, PanelRightOpen } from "lucide-react";

// Dynamically import the editor to avoid SSR issues with BlockNote
const MarkdownEditor = dynamic(
  () => import("@/components/markdown-editor").then((mod) => mod.MarkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading editor...
      </div>
    ),
  }
);

export default function Home() {
  const {
    setIsCommandPaletteOpen,
    setIsSettingsModalOpen,
    setSettings,
    setSettingsLoaded,
    isSettingsLoaded,
    isChatPanelOpen,
    setIsChatPanelOpen,
    activeFile,
    selectedText,
    triggerRefresh,
    incrementEditorVersion,
    pendingChange,
    clearPendingChange,
  } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await readSettings();
        setSettings(settings);
        setSettingsLoaded(true);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setSettingsLoaded(true); // Still set to true so app can work with defaults
      }
    }
    loadSettings();
  }, [setSettings, setSettingsLoaded]);

  // Clear pending change when file path changes to prevent accidental overwrites
  useEffect(() => {
    if (pendingChange && activeFile !== pendingChange.filePath) {
      console.log("[Page] File path changed, clearing pending change");
      clearPendingChange();
    }
  }, [activeFile, pendingChange, clearPendingChange]);

  // Handlers for diff panel
  const handleDiffAccepted = useCallback(() => {
    console.log("[Page] Diff changes accepted");
    triggerRefresh();
  }, [triggerRefresh]);

  const handleDiffRejected = useCallback(() => {
    console.log("[Page] Diff changes rejected");
  }, []);

  // Show loading state while settings are loading
  if (!isSettingsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading MD Explorer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <PanelLeftOpen className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            MD Explorer
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsChatPanelOpen(!isChatPanelOpen)}
            className={`p-1.5 rounded-md transition-colors ${
              isChatPanelOpen 
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
            title={isChatPanelOpen ? "Close AI Copilot" : "AI Copilot"}
          >
            {isChatPanelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title="Settings (Ctrl+,)"
          >
            <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Command</span>
            <kbd className="text-xs bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-600">
              Ctrl+K
            </kbd>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <FileTree />
          </aside>
        )}

        {/* Editor area */}
        <main className="flex-1 overflow-hidden bg-white dark:bg-gray-950">
          <MarkdownEditor />
        </main>

        {/* AI Copilot Chat Panel */}
        <ChatPanel
          isOpen={isChatPanelOpen}
          onClose={() => setIsChatPanelOpen(false)}
          currentFilePath={activeFile}
          selectedText={selectedText}
          onFileUpdated={triggerRefresh}
          onForceEditorRefresh={incrementEditorVersion}
        />
      </div>

      {/* Command palette */}
      <CommandPalette />
      
      {/* Settings modal */}
      <SettingsModal />

      {/* Context menu (right-click) */}
      <ContextMenu />

      {/* Delete confirmation dialog */}
      <ConfirmationDialog />

      {/* Diff Review Panel - shown when AI proposes changes */}
      {pendingChange && (
        <DiffReviewPanel
          onAccepted={handleDiffAccepted}
          onRejected={handleDiffRejected}
        />
      )}
    </div>
  );
}
