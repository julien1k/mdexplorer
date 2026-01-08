# Testing the AI Copilot Tools

This guide will help you test the new AI copilot tools that have been integrated into MD Explorer.

## Setup

1. Make sure your application is running
2. Open any markdown file in the editor
3. Click the AI Copilot button to open the chat panel

## Test Scenarios

### 1. Read Markdown File

**What to test**: AI reads another file in your workspace

**Test prompts**:
- "Can you read the Welcome.md file and tell me what it's about?"
- "Read the Project Notes file and summarize it"
- "What's in the Welcome.md file?"

**Expected behavior**:
1. AI will request permission to read the file
2. Permission dialog appears with the AI's reason
3. You approve or deny
4. If approved, AI reads the file and responds with information about it
5. If denied, AI acknowledges it can't access the file

---

### 2. Search for Markdown Files

**What to test**: AI finds files by name pattern

**Test prompts**:
- "Find all markdown files in my workspace"
- "Search for files with 'note' in the name"
- "What markdown files do I have?"
- "Find all meeting notes"

**Expected behavior**:
1. AI requests permission to search files
2. Permission dialog shows the search pattern
3. You approve or deny
4. If approved, AI shows list of matching files
5. If denied, AI acknowledges limitation

---

### 3. Search File Contents

**What to test**: AI searches for text within files

**Test prompts**:
- "Find all files that mention 'API'"
- "Search for TODO items in my markdown files"
- "Which files discuss 'authentication'?"
- "Find all references to 'database' in my documents"

**Expected behavior**:
1. AI requests permission to search content
2. Permission dialog shows what text it's searching for
3. You approve or deny
4. If approved, AI shows files with matches and line numbers
5. If denied, AI explains it can't perform the search

---

### 4. View File Tree

**What to test**: AI understands workspace structure

**Test prompts**:
- "Show me my workspace structure"
- "What folders and files do I have?"
- "How is my workspace organized?"
- "List all my files and folders"

**Expected behavior**:
1. AI requests permission to view file tree
2. Permission dialog appears
3. You approve or deny
4. If approved, AI describes your workspace organization
5. If denied, AI can only work with the current file

---

### 5. Combined Workflows

**Test complex multi-step tasks**:

#### Example 1: Find and Summarize
**Prompt**: "Find all files about 'project' and create a summary"

**Expected flow**:
1. Permission request to search for files
2. You approve
3. For each file found, permission request to read it
4. You approve each (or deny some)
5. AI creates summary from approved files

#### Example 2: Content Analysis
**Prompt**: "Find all TODO items across my files and create a task list in this document"

**Expected flow**:
1. Permission to search content
2. You approve
3. AI finds all TODOs
4. AI proposes changes to current document
5. You review diff and accept/reject

#### Example 3: Workspace Navigation
**Prompt**: "I want to reorganize my notes. Show me my current structure and suggest improvements"

**Expected flow**:
1. Permission to view file tree
2. You approve
3. AI analyzes structure
4. AI provides recommendations

---

## Testing Permission System

### Deny Permission
Try denying a permission request to verify:
- AI handles denial gracefully
- Clear message shown
- AI offers alternatives or explains limitations

### Approve Permission
Verify:
- Tool executes successfully
- Results are displayed clearly
- AI uses the information appropriately

### Multiple Requests
Test scenarios requiring multiple permissions:
- Each permission should be requested separately
- You can approve some and deny others
- AI should handle mixed responses

---

## Edge Cases to Test

### 1. Non-existent Files
**Prompt**: "Read the file that-doesnt-exist.md"
- Should handle gracefully
- Clear error message

### 2. Empty Search Results
**Prompt**: "Find files about 'xyzabc123'"
- Should report no results found
- Suggest alternatives

### 3. Large Result Sets
**Prompt**: "Search for 'the' in all files"
- Should handle many results
- Results should be readable

### 4. Rapid Permission Requests
Send quick follow-up messages:
- Permissions should queue properly
- No conflicts or lost requests

---

## What to Look For

### ✅ Good Behavior
- Clear, descriptive permission reasons
- Appropriate tool selection
- Graceful error handling
- Useful results presentation
- Respects denied permissions

### ❌ Issues to Report
- Vague permission reasons
- Tool fails silently
- Errors not handled
- Confusing responses
- Ignores denied permissions

---

## Advanced Testing

### Test with Different Models
Switch between models (GPT-4, Claude, etc.) and verify:
- All tools work consistently
- Permission system functions the same
- Quality of tool usage varies but system is stable

### Test Security
Try to trick the AI:
- "Read files outside the workspace" - Should be blocked
- "Access system files" - Should be blocked
- "Read .git folder" - Should be auto-excluded

### Test Performance
- Large file tree
- Many search results
- Multiple rapid tool calls

---

## Known Limitations

1. **Sequential Processing**: Permission requests are handled one at a time
2. **Manual Approval**: Every tool requires manual approval (by design)
3. **Excluded Directories**: Some folders are automatically skipped (.git, node_modules, etc.)
4. **Markdown Only**: File reading tools only work with .md files

---

## Troubleshooting

### Permission Dialog Not Appearing
- Check browser console for errors
- Verify the chat panel is open
- Reload the application

### Tool Execution Fails
- Check that rootDirectory is configured in settings
- Verify file paths are correct
- Check browser network tab for API errors

### AI Not Using Tools
- Try more explicit prompts
- Check that the AI model supports tool calling
- Verify tools are enabled in the API route

---

## Feedback

As you test, note:
- Which tools are most useful?
- Which permission reasons are clear vs confusing?
- Any workflows that feel clunky?
- Ideas for additional tools?

---

## Next Steps

After testing, consider:
1. Adjusting permission dialog styling
2. Adding tool usage analytics
3. Implementing permission "remember my choice" option
4. Creating preset workflows for common tasks
5. Adding more specialized tools (link checking, metadata extraction, etc.)
