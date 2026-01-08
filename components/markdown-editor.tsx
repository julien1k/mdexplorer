"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useAppStore } from "@/stores/app-store";
import { writeFile, readFile as readFileAction, resolveWikiLink, openInSystemApp } from "@/actions/file-actions";
import { addRecentFile } from "@/actions/recent-files-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { FileText, Save, Clock, Link } from "lucide-react";

// Autosave delay in milliseconds
const AUTOSAVE_DELAY = 1500;

// Wiki link regex pattern: [[target]]
const WIKI_LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

export function MarkdownEditor() {
  const {
    activeFile,
    editorContent,
    setEditorContent,
    setActiveFile,
    isDirty,
    setIsDirty,
    editorVersion,
  } = useAppStore();

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "idle">("idle");
  const [headingsCollapsed, setHeadingsCollapsed] = useState(false);
  const initialLoadRef = useRef(true);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Create the BlockNote editor
  const editor = useCreateBlockNote({
    domAttributes: {
      editor: {
        class: "blocknote-editor",
      },
    },
  });

  // Expose editor and collapse function globally for command palette
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __mdexplorer_editor?: typeof editor }).__mdexplorer_editor = editor;
      (window as unknown as { __mdexplorer_toggleHeadings?: () => void }).__mdexplorer_toggleHeadings = () => {
        setHeadingsCollapsed((prev) => !prev);
      };
    }
  }, [editor]);

  // Load markdown content into editor when activeFile, editorContent, or editorVersion changes
  // editorVersion is incremented when AI updates the document to force a refresh
  useEffect(() => {
    async function loadContent() {
      if (!editor) return;
      
      try {
        initialLoadRef.current = true;
        
        if (editorContent) {
          // Parse and load markdown content
          const blocks = await editor.tryParseMarkdownToBlocks(editorContent);
          // Get current block IDs to replace
          const currentBlockIds = editor.document.map(block => block.id);
          if (currentBlockIds.length > 0) {
            editor.replaceBlocks(currentBlockIds, blocks);
          } else {
            // If no blocks exist, insert the new blocks
            editor.insertBlocks(blocks, editor.document[0] || { id: "__first__" }, "before");
          }
        } else {
          // Empty content (new file) - replace with a single empty paragraph
          const currentBlockIds = editor.document.map(block => block.id);
          if (currentBlockIds.length > 0) {
            editor.replaceBlocks(currentBlockIds, [{ type: "paragraph" }]);
          }
        }
        
        // Reset dirty state after loading
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 100);
      } catch (error) {
        console.error("Failed to parse markdown:", error);
      }
    }
    loadContent();
  }, [editorContent, editor, activeFile, editorVersion]);

  // Save function
  const saveToFile = useCallback(async () => {
    if (!activeFile || !editor) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      const result = await writeFile(activeFile, markdown);

      if (result.success) {
        setIsDirty(false);
        setLastSaved(new Date());
        setSaveStatus("saved");
        // Track save in recent files
        await addRecentFile(activeFile, "save");
      } else {
        console.error("Failed to save:", result.error);
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, editor, setIsDirty]);

  // Expose save function globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __mdexplorer_save?: () => void }).__mdexplorer_save = saveToFile;
    }
  }, [saveToFile]);

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback(async (target: string) => {
    const result = await resolveWikiLink(target, activeFile || undefined);
    
    if (!result) {
      console.warn(`Wiki link not found: ${target}`);
      return;
    }

    if (result.isMarkdown) {
      // Load the markdown file in the editor
      try {
        const content = await readFileAction(result.path);
        setActiveFile(result.path);
        setEditorContent(content);
        setIsDirty(false);
      } catch (error) {
        console.error("Failed to open linked file:", error);
      }
    } else {
      // Open non-markdown files in system default app
      await openInSystemApp(result.path);
    }
  }, [activeFile, setActiveFile, setEditorContent, setIsDirty]);

  // Expose wiki link handler globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __mdexplorer_openWikiLink?: (target: string) => void }).__mdexplorer_openWikiLink = handleWikiLinkClick;
    }
  }, [handleWikiLinkClick]);

  // Click handler for wiki links in the editor
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if clicked element contains wiki link syntax
      const text = target.textContent || "";
      const match = text.match(/\[\[([^\]]+)\]\]/);
      
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        await handleWikiLinkClick(match[1]);
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [handleWikiLinkClick]);

  // Debounced autosave
  const debouncedSave = useDebounce(saveToFile, AUTOSAVE_DELAY);

  // Handle editor changes - syncs BlockNote content to Zustand store
  // This ensures the AI chat always sees the latest editor content
  const handleEditorChange = useCallback(async () => {
    // Skip if this is the initial load
    if (initialLoadRef.current) return;
    
    if (activeFile && editor) {
      setIsDirty(true);
      setSaveStatus("idle");
      
      // Sync editor content to store so AI chat gets the latest content
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        setEditorContent(markdown);
      } catch (error) {
        console.error("Failed to sync editor content:", error);
      }
      
      debouncedSave();
    }
  }, [activeFile, editor, setIsDirty, setEditorContent, debouncedSave]);

  // Format last saved time
  const lastSavedText = useMemo(() => {
    if (!lastSaved) return null;
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return lastSaved.toLocaleTimeString();
  }, [lastSaved]);

  // Apply heading collapse styles
  useEffect(() => {
    const editorElement = document.querySelector(".blocknote-editor");
    if (editorElement) {
      if (headingsCollapsed) {
        editorElement.classList.add("headings-collapsed");
      } else {
        editorElement.classList.remove("headings-collapsed");
      }
    }
  }, [headingsCollapsed]);

  // Empty state when no file is selected
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-8">
        <div className="empty-state-container">
          <div className="empty-state-icon">
            <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Start Writing
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm mb-8 leading-relaxed">
            Select a file from the sidebar or create something new
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <div className="empty-state-hint">
              <kbd className="kbd-key">Ctrl</kbd>
              <span className="text-gray-400">+</span>
              <kbd className="kbd-key">K</kbd>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-3">Command palette</span>
            </div>
            <div className="empty-state-hint">
              <kbd className="kbd-key">Ctrl</kbd>
              <span className="text-gray-400">+</span>
              <kbd className="kbd-key">N</kbd>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-3">New file</span>
            </div>
          </div>

          <div className="mt-10 p-5 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200/60 dark:border-gray-700/40 max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <Link className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Wiki Links</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Link files with <code className="code-inline">[[filename]]</code> syntax
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#fafafa] dark:bg-[#0f0f0f]">
      {/* Editor header - minimal and modern */}
      <div className="editor-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[280px]">
              {activeFile.split(/[\\/]/).pop()}
            </span>
          </div>
          {isDirty && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium">Unsaved</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save status - elegant minimal display */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="w-3 h-3 border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-300 rounded-full animate-spin" />
                Saving
              </span>
            )}
            {saveStatus === "saved" && lastSavedText && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Save className="h-3 w-3" />
                Saved {lastSavedText}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-500 dark:text-red-400">Save failed</span>
            )}
          </div>

          {/* Manual save button - modern pill style */}
          <button
            onClick={saveToFile}
            disabled={isSaving || !isDirty}
            className="save-button"
            title="Save (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* BlockNote Editor */}
      <div 
        className="flex-1 overflow-auto editor-container" 
        ref={editorContainerRef}
      >
        <div className="editor-content-wrapper">
          <BlockNoteView
            editor={editor}
            onChange={handleEditorChange}
            theme="light"
            className="modern-editor"
          />
        </div>
      </div>
    </div>
  );
}
