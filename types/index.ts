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

/**
 * Represents a tool permission request from the AI
 */
export interface ToolPermissionRequest {
  /** Unique identifier for this permission request */
  id: string;
  /** The name of the tool being requested */
  toolName: string;
  /** The action being requested (read, write, search, etc.) */
  action: string;
  /** The reason provided by the AI for needing this permission */
  reason: string;
  /** Additional parameters specific to the tool */
  parameters: Record<string, unknown>;
  /** Timestamp when the request was made */
  timestamp: number;
  /** Status of the request */
  status: "pending" | "approved" | "denied";
}

/**
 * Tool execution result returned to the AI
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
