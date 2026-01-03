export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
  children?: FileNode[];
}

export interface FileTreeState {
  expanded: Set<string>;
  activeFile: string | null;
}

export interface EditorState {
  content: string;
  filePath: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
}

export interface AppSettings {
  rootDirectory: string;
  excludedExtensions: string[];
  excludedFolders: string[];
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: AppSettings = {
  rootDirectory: "",
  excludedExtensions: [".exe", ".dll", ".log", ".tmp", ".cache"],
  excludedFolders: [".git", "node_modules", ".next", ".vscode", "__pycache__", ".cache"],
  theme: "system",
};

export interface WikiLink {
  text: string;
  target: string;
  isMarkdown: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
  action: "open" | "save";
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetNode: FileNode | null;
}

/**
 * Represents a pending AI-proposed change waiting for user approval
 */
export interface PendingChange {
  /** The file path the change applies to */
  filePath: string;
  /** The original content before the proposed change */
  originalContent: string;
  /** The AI's proposed new content */
  proposedContent: string;
  /** Summary of what the AI changed */
  summary: string;
  /** Timestamp when the proposal was created */
  timestamp: number;
}
