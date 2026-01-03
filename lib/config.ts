import path from "path";

// Configure your root directory here
// This is the base path where the file browser will start
export const ROOT_DIRECTORY = process.env.MD_EXPLORER_ROOT || path.join(process.cwd(), "documents");

// File extensions that should open in the editor
export const MARKDOWN_EXTENSIONS = [".md", ".mdx", ".markdown"];

// Hidden files/folders to exclude from the tree
export const HIDDEN_PATTERNS = [
  /^\.git$/,
  /^node_modules$/,
  /^\.next$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
];

export function isMarkdownFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext);
}

export function isHidden(name: string): boolean {
  return HIDDEN_PATTERNS.some((pattern) => pattern.test(name));
}
