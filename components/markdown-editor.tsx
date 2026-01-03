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
      if (editorContent && editor) {
        try {
          initialLoadRef.current = true;
          const blocks = await editor.tryParseMarkdownToBlocks(editorContent);
          editor.replaceBlocks(editor.document, blocks);
          // Reset dirty state after loading
          setTimeout(() => {
            initialLoadRef.current = false;
          }, 100);
        } catch (error) {
          console.error("Failed to parse markdown:", error);
        }
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

  // Handle editor changes
  const handleEditorChange = useCallback(() => {
    // Skip if this is the initial load
    if (initialLoadRef.current) return;
    
    if (activeFile) {
      setIsDirty(true);
      setSaveStatus("idle");
      debouncedSave();
    }
  }, [activeFile, setIsDirty, debouncedSave]);

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
      <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
        <FileText className="h-16 w-16 mb-4 opacity-50" />
        <h2 className="text-xl font-medium mb-2">No file selected</h2>
        <p className="text-sm text-center max-w-md">
          Select a markdown file from the sidebar to start editing, or press{" "}
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
            Ctrl + K
          </kbd>{" "}
          to create a new file.
        </p>
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-w-md">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Link className="h-4 w-4" />
            Wiki-style Links
          </h3>
          <p className="text-xs text-gray-500">
            Use <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">[[filename.md]]</code> syntax 
            to link to other files. Click the link to navigate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium truncate max-w-[300px]">
            {activeFile.split(/[\\/]/).pop()}
          </span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {saveStatus === "saving" && (
              <>
                <Clock className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && lastSavedText && (
              <>
                <Save className="h-3 w-3 text-green-500" />
                <span>Saved {lastSavedText}</span>
              </>
            )}
            {saveStatus === "error" && (
              <span className="text-red-500">Failed to save</span>
            )}
          </div>

          {/* Manual save button */}
          <button
            onClick={saveToFile}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>

      {/* BlockNote Editor */}
      <div className="flex-1 overflow-auto p-4" ref={editorContainerRef}>
        <div className="max-w-4xl mx-auto">
          <BlockNoteView
            editor={editor}
            onChange={handleEditorChange}
            theme="light"
          />
        </div>
      </div>
    </div>
  );
}
