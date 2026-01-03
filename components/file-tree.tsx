"use client";

import React, { useEffect, useCallback, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useAppStore } from "@/stores/app-store";
import { readDirectory, readFile, openInSystemApp, openInExplorer } from "@/actions/file-actions";
import { moveItem, renameItem, createFile, createFolder } from "@/actions/file-management-actions";
import { addRecentFile } from "@/actions/recent-files-actions";
import { isMarkdownFile } from "@/lib/config";
import type { FileNode } from "@/types";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
  File,
  RefreshCw,
  FilePlus,
  FolderPlus,
  GripVertical,
} from "lucide-react";

function getFileIcon(node: FileNode) {
  if (node.type === "directory") {
    return null;
  }

  const ext = node.extension?.toLowerCase();

  if (isMarkdownFile(node.name)) {
    return <FileText className="h-4 w-4 text-blue-500" />;
  }

  if ([".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css"].includes(ext || "")) {
    return <FileCode className="h-4 w-4 text-yellow-500" />;
  }

  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext || "")) {
    return <FileImage className="h-4 w-4 text-green-500" />;
  }

  return <File className="h-4 w-4 text-gray-400" />;
}

interface DraggableItemProps {
  node: FileNode;
  depth: number;
  isDragOverlay?: boolean;
}

function DraggableItem({ node, depth, isDragOverlay }: DraggableItemProps) {
  const {
    expandedFolders,
    toggleFolder,
    activeFile,
    setActiveFile,
    setEditorContent,
    setIsDirty,
    openContextMenu,
    renamingNode,
    setRenamingNode,
    triggerRefresh,
    creatingItem,
    setCreatingItem,
  } = useAppStore();

  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedFolders.has(node.path);
  const isActive = activeFile === node.path;
  const isDirectory = node.type === "directory";
  const isMarkdown = !isDirectory && isMarkdownFile(node.name);
  const isRenaming = renamingNode?.path === node.path;

  // Draggable hook
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.path,
    data: { node },
  });

  // Droppable hook (only for directories)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-${node.path}`,
    data: { node },
    disabled: !isDirectory,
  });

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Reset rename value when node changes
  useEffect(() => {
    setRenameValue(node.name);
  }, [node.name]);

  const handleClick = useCallback(async () => {
    if (isRenaming) return;
    
    if (isDirectory) {
      toggleFolder(node.path);
    } else if (isMarkdown) {
      try {
        const content = await readFile(node.path);
        setActiveFile(node.path);
        setEditorContent(content);
        setIsDirty(false);
        // Track in recent files
        await addRecentFile(node.path, "open");
      } catch (error) {
        console.error("Failed to read file:", error);
      }
    } else {
      await openInSystemApp(node.path);
    }
  }, [isDirectory, isMarkdown, isRenaming, node.path, toggleFolder, setActiveFile, setEditorContent, setIsDirty]);

  const handleDoubleClick = useCallback(async () => {
    if (isRenaming) return;
    
    if (isDirectory) {
      await openInExplorer(node.path);
    }
  }, [isDirectory, isRenaming, node.path]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, node);
  }, [node, openContextMenu]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameValue.trim() || renameValue === node.name) {
      setRenamingNode(null);
      setRenameValue(node.name);
      return;
    }

    const result = await renameItem(node.path, renameValue.trim());
    if (result.success) {
      triggerRefresh();
    } else {
      alert(`Failed to rename: ${result.error}`);
      setRenameValue(node.name);
    }
    setRenamingNode(null);
  }, [renameValue, node.name, node.path, setRenamingNode, triggerRefresh]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenamingNode(null);
      setRenameValue(node.name);
    }
  }, [handleRenameSubmit, setRenamingNode, node.name]);

  // Combine refs for directories (both draggable and droppable)
  const setRef = useCallback((el: HTMLDivElement | null) => {
    setDraggableRef(el);
    if (isDirectory) {
      setDroppableRef(el);
    }
  }, [setDraggableRef, setDroppableRef, isDirectory]);

  const style = transform && !isDragOverlay
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div>
      <div
        ref={setRef}
        className={cn(
          "flex items-center gap-1 py-1 px-2 cursor-pointer rounded-md transition-colors group",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          isActive && "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
          isDragging && "opacity-50",
          isOver && isDirectory && "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400",
          isDragOverlay && "bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
        )}
        style={{ paddingLeft: isDragOverlay ? "8px" : `${depth * 12 + 8}px`, ...style }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={isDirectory ? "Click to expand, double-click to open in Explorer" : node.path}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3 text-gray-400" />
        </span>

        {/* Expand/collapse icon for directories */}
        {isDirectory ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* File/folder icon */}
        <span className="flex-shrink-0">
          {isDirectory ? (
            isExpanded || isOver ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500" />
            )
          ) : (
            getFileIcon(node)
          )}
        </span>

        {/* File/folder name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            className="flex-1 text-sm bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-sm">{node.name}</span>
        )}
      </div>

      {/* Render children if expanded */}
      {isDirectory && isExpanded && node.children && (
        <div>
          {/* New item input inside this folder if selected */}
          {creatingItem && creatingItem.parentPath === node.path && (
            <NewItemInput
              type={creatingItem.type}
              parentPath={creatingItem.parentPath}
              depth={depth + 1}
              onComplete={() => setCreatingItem(null)}
            />
          )}
          {node.children.map((child) => (
            <DraggableItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline input for creating new files/folders
function NewItemInput({ type, parentPath, depth, onComplete }: { 
  type: "file" | "folder"; 
  parentPath: string;
  depth: number;
  onComplete: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { triggerRefresh, setActiveFile, setEditorContent, setIsDirty } = useAppStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!value.trim()) {
      onComplete();
      return;
    }

    let result;
    if (type === "file") {
      const fileName = value.endsWith(".md") ? value : `${value}.md`;
      result = await createFile(parentPath, fileName, "");
      
      if (result.success && result.filePath) {
        // Open the new file
        setActiveFile(result.filePath);
        setEditorContent("");
        setIsDirty(false);
        await addRecentFile(result.filePath, "open");
      }
    } else {
      result = await createFolder(parentPath, value.trim());
    }

    if (result.success) {
      triggerRefresh();
    } else {
      alert(`Failed to create ${type}: ${result.error}`);
    }

    onComplete();
  }, [value, type, parentPath, onComplete, triggerRefresh, setActiveFile, setEditorContent, setIsDirty]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      onComplete();
    }
  };

  return (
    <div 
      className="flex items-center gap-1 py-1 px-2" 
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-4" />
      <span className="w-4" />
      <span className="flex-shrink-0">
        {type === "folder" ? (
          <Folder className="h-4 w-4 text-amber-500" />
        ) : (
          <FileText className="h-4 w-4 text-blue-500" />
        )}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={type === "file" ? "filename.md" : "folder name"}
        className="flex-1 text-sm bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0 outline-none"
      />
    </div>
  );
}

export function FileTree() {
  const {
    files,
    setFiles,
    refreshTrigger,
    triggerRefresh,
    settings,
    isSettingsLoaded,
    creatingItem,
    setCreatingItem,
    toggleFolder,
    expandedFolders,
  } = useAppStore();

  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Load files on mount and when refresh is triggered or settings change
  useEffect(() => {
    async function loadFiles() {
      if (!isSettingsLoaded) return;

      try {
        const fileTree = await readDirectory();
        setFiles(fileTree);
      } catch (error) {
        console.error("Failed to load files:", error);
      }
    }
    loadFiles();
  }, [setFiles, refreshTrigger, settings.rootDirectory, isSettingsLoaded]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const node = active.data.current?.node as FileNode;
    setDraggedNode(node);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedNode(null);

    if (!over || active.id === over.id) return;

    const sourceNode = active.data.current?.node as FileNode;
    const targetNode = over.data.current?.node as FileNode;

    if (!sourceNode || !targetNode) return;

    // Can only drop into directories
    if (targetNode.type !== "directory") return;

    // Don't drop into self or parent
    if (sourceNode.path === targetNode.path) return;
    if (targetNode.path.startsWith(sourceNode.path)) return;

    const result = await moveItem(sourceNode.path, targetNode.path);

    if (result.success) {
      // Expand the target folder to show the moved item
      if (!expandedFolders.has(targetNode.path)) {
        toggleFolder(targetNode.path);
      }
      triggerRefresh();
    } else {
      console.error("Failed to move:", result.error);
      alert(`Failed to move: ${result.error}`);
    }
  }, [expandedFolders, toggleFolder, triggerRefresh]);

  const handleNewFile = useCallback(() => {
    setCreatingItem({ type: "file", parentPath: settings.rootDirectory });
  }, [setCreatingItem, settings.rootDirectory]);

  const handleNewFolder = useCallback(() => {
    setCreatingItem({ type: "folder", parentPath: settings.rootDirectory });
  }, [setCreatingItem, settings.rootDirectory]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Explorer
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewFile}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="New File"
            >
              <FilePlus className="h-4 w-4 text-gray-500" />
            </button>
            <button
              onClick={handleNewFolder}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="New Folder"
            >
              <FolderPlus className="h-4 w-4 text-gray-500" />
            </button>
            <button
              onClick={triggerRefresh}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh file tree"
            >
              <RefreshCw className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Current root indicator */}
        <div
          className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800 truncate"
          title={settings.rootDirectory}
        >
          📁 {settings.rootDirectory.split(/[\\/]/).slice(-2).join("/")}
        </div>

        {/* File tree content */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* New item input at root level */}
          {creatingItem && creatingItem.parentPath === settings.rootDirectory && (
            <NewItemInput
              type={creatingItem.type}
              parentPath={creatingItem.parentPath}
              depth={0}
              onComplete={() => setCreatingItem(null)}
            />
          )}

          {files.length === 0 && !creatingItem ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <p>No files found.</p>
              <p className="mt-1 text-xs">
                Click the <FilePlus className="inline h-3 w-3" /> icon to create a file
              </p>
            </div>
          ) : (
            files.map((node) => (
              <DraggableItem key={node.path} node={node} depth={0} />
            ))
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedNode ? (
          <div className="opacity-90">
            <DraggableItem node={draggedNode} depth={0} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
