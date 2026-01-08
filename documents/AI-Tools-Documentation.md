# AI Copilot Tools Documentation

This document describes the AI-native tools available to the copilot assistant in MD Explorer.

## Overview

MD Explorer has been enhanced with an AI copilot that has intelligent tools for working with markdown files. All tools require explicit user permission before execution to ensure safety and transparency.

## Available Tools

### 1. Read Markdown File (`readMarkdownFile`)

**Purpose**: Read the contents of a specific markdown file.

**Use Cases**:
- Answering questions about file contents
- Analyzing document structure
- Gathering context for suggestions
- Cross-referencing information

**Parameters**:
- `filePath` (string, required): Absolute path to the markdown file
- `reason` (string, required): Clear explanation shown to user for permission

**Returns**:
- File path and name
- Complete file content
- File size and modification date

**Example**:
```typescript
{
  filePath: "/path/to/document.md",
  reason: "To analyze the document structure for table of contents generation"
}
```

---

### 2. Search Markdown Files (`searchMarkdownFiles`)

**Purpose**: Find markdown files by name pattern.

**Use Cases**:
- Finding files by partial name
- Discovering all markdown files in workspace
- Locating specific documents
- Building file inventories

**Parameters**:
- `pattern` (string, optional): Case-insensitive search pattern for filenames
- `reason` (string, required): Clear explanation shown to user for permission

**Returns**:
- Array of matching files with paths and names
- Total count of files found
- Relative paths from workspace root

**Example**:
```typescript
{
  pattern: "meeting",
  reason: "To find all meeting notes for summarization"
}
```

---

### 3. Search Markdown Content (`searchMarkdownContent`)

**Purpose**: Search for specific text within markdown file contents.

**Use Cases**:
- Finding files containing specific keywords
- Locating where topics are discussed
- Building reference lists
- Content discovery

**Parameters**:
- `query` (string, required): Text to search for
- `filePattern` (string, optional): Filter files by name pattern
- `reason` (string, required): Clear explanation shown to user for permission

**Returns**:
- Files containing matches
- Line numbers and text snippets for each match
- Total files searched and match counts

**Example**:
```typescript
{
  query: "TODO",
  filePattern: "project",
  reason: "To find all TODO items in project-related documents"
}
```

---

### 4. List File Tree (`listFileTree`)

**Purpose**: View the complete file and folder structure.

**Use Cases**:
- Understanding workspace organization
- Finding document locations
- Providing navigation suggestions
- Analyzing content structure

**Parameters**:
- `reason` (string, required): Clear explanation shown to user for permission

**Returns**:
- Hierarchical tree structure
- File and folder names with full paths
- File extensions for type identification

**Example**:
```typescript
{
  reason: "To understand the workspace structure for better file organization suggestions"
}
```

---

### 5. Propose Document Change (`proposeDocumentChange`)

**Purpose**: Suggest modifications to the currently open file.

**Use Cases**:
- Editing document content
- Adding new sections
- Reformatting or restructuring
- Fixing errors or improving text

**Parameters**:
- `path` (string, required): Exact absolute path from context
- `newContent` (string, required): Complete new file content
- `summary` (string, required): Brief description of changes

**Returns**:
- Proposed content for diff review
- Change summary
- Timestamp

**Note**: This tool triggers the diff review interface where users can accept or reject changes.

---

## Permission System

### How It Works

1. **Tool Request**: AI decides it needs to use a tool
2. **Permission Request**: Tool returns a permission request with:
   - Tool name and description
   - Clear reason from the AI
   - Specific parameters being used
3. **User Decision**: Permission dialog appears for user to approve/deny
4. **Execution**: If approved, tool executes via `/api/chat/execute-tool`
5. **Result**: Tool result is returned to AI for processing

### Permission Request Structure

```typescript
interface ToolPermissionRequest {
  id: string;                      // Unique identifier
  toolName: string;                // Name of tool
  action: string;                  // Action type (read, search, etc.)
  reason: string;                  // AI's explanation
  parameters: Record<string, any>; // Tool parameters
  timestamp: number;               // When requested
  status: "pending" | "approved" | "denied";
}
```

### Security Features

- **Path validation**: All file operations are restricted to workspace root
- **Explicit consent**: Every tool requires user approval
- **Transparent reasoning**: AI must explain why it needs each permission
- **Excluded directories**: Automatically skips node_modules, .git, etc.
- **Markdown-only**: File reading tools only work with .md files

---

## API Endpoints

### POST `/api/chat`

Main chat endpoint for AI conversations.

**Request Body**:
```typescript
{
  messages: UIMessage[];
  model?: string;
  filePath?: string;
  fileContent?: string;
  selectedText?: string;
  rootDirectory?: string;
}
```

### POST `/api/chat/execute-tool`

Executes approved tool requests.

**Request Body**:
```typescript
{
  toolName: string;
  parameters: Record<string, any>;
  rootDirectory?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
}
```

---

## Usage Examples

### Example 1: Finding Related Content

**User**: "Find all files that mention 'API design'"

**AI Process**:
1. Calls `searchMarkdownContent` with query "API design"
2. Requests permission with reason: "To locate all documents discussing API design"
3. User approves
4. Receives list of files with line numbers
5. Responds with formatted list of findings

### Example 2: Creating a Summary Document

**User**: "Create a summary of all meeting notes"

**AI Process**:
1. Calls `searchMarkdownFiles` with pattern "meeting"
2. Requests permission with reason: "To find all meeting note files"
3. User approves
4. For each file found, calls `readMarkdownFile`
5. Each read requires separate permission
6. User approves all reads
7. Analyzes content and calls `proposeDocumentChange` with summary
8. User reviews diff and accepts/rejects

### Example 3: Workspace Navigation Help

**User**: "Where should I put my project documentation?"

**AI Process**:
1. Calls `listFileTree`
2. Requests permission with reason: "To understand your current workspace organization"
3. User approves
4. Analyzes structure
5. Provides recommendation based on existing organization

---

## Best Practices for AI

### Clear Reasoning
Always provide specific, user-friendly reasons:
- ✅ "To analyze document structure for table of contents"
- ❌ "Need to read file"

### Appropriate Tool Selection
- Use `readMarkdownFile` for specific files
- Use `searchMarkdownFiles` for discovery
- Use `searchMarkdownContent` for content-based queries
- Use `listFileTree` for understanding structure

### Minimize Permission Requests
- Batch related operations when possible
- Ask for most useful information first
- Explain what you'll do with the data

### Respect User Decisions
- Don't repeatedly request denied permissions
- Provide alternatives if permission is denied
- Explain limitations clearly

---

## Future Enhancements

Potential additional tools:
- Create new markdown files
- Move/rename files
- Link analysis and validation
- Tag and metadata extraction
- Image and asset management
- Export to various formats

---

## Technical Implementation

### File Structure
- `/app/api/chat/route.ts` - Main chat endpoint with tool definitions
- `/app/api/chat/execute-tool/route.ts` - Tool execution endpoint
- `/components/tool-permission-dialog.tsx` - Permission UI
- `/stores/app-store.ts` - State management for permissions
- `/types/index.ts` - TypeScript definitions

### Key Technologies
- AI SDK by Vercel for tool calling
- Zustand for state management
- Framer Motion for animations
- Next.js App Router for API routes

---

## Troubleshooting

### Permission Dialogs Not Appearing
- Check that `setToolPermissionRequest` is called in chat panel
- Verify ToolPermissionDialog is rendered in layout
- Check browser console for errors

### Tools Not Executing
- Ensure rootDirectory is passed to API
- Verify file paths are absolute
- Check security validation in execute-tool route

### Tool Results Not Returned
- Check network tab for API responses
- Verify tool execution endpoint is responding
- Check console for error messages

---

## Contributing

When adding new tools:
1. Define tool in `/app/api/chat/route.ts`
2. Implement execution in `/app/api/chat/execute-tool/route.ts`
3. Add TypeScript types to `/types/index.ts`
4. Update this documentation
5. Add appropriate icons and labels to permission dialog
6. Test permission flow end-to-end
