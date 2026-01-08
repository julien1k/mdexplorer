# AI Copilot Quick Reference

## Available Tools

| Tool | Purpose | Permission Required |
|------|---------|-------------------|
| **Read Markdown File** | Read contents of a specific .md file | ✅ Yes |
| **Search Markdown Files** | Find files by name pattern | ✅ Yes |
| **Search Content** | Search text within files | ✅ Yes |
| **List File Tree** | View workspace structure | ✅ Yes |
| **Propose Changes** | Edit current document | ✅ Yes (via diff review) |

## Quick Prompts

### Reading Files
```
"Read the Welcome.md file"
"What's in Project Notes.md?"
"Show me the contents of [filename]"
```

### Finding Files
```
"Find all markdown files"
"Search for files with 'meeting' in the name"
"What files do I have about projects?"
```

### Searching Content
```
"Find all TODO items"
"Which files mention 'API'?"
"Search for 'database' in my notes"
```

### Workspace Navigation
```
"Show me my workspace structure"
"How are my files organized?"
"List all my folders"
```

### Editing Current File
```
"Add a table of contents"
"Fix the formatting"
"Summarize this into bullet points"
"Add a section about [topic]"
```

## Permission Flow

1. **AI Needs Tool** → Makes request
2. **Permission Dialog** → Shows reason & details
3. **You Decide** → Approve or Deny
4. **Tool Executes** → If approved
5. **AI Responds** → With results

## Tips

### ✅ Do
- Read permission reasons carefully
- Approve tools when the reason is clear
- Deny if uncertain
- Use specific file names when possible
- Combine tools for complex tasks

### ❌ Don't
- Approve without reading the reason
- Expect tools to work on non-markdown files
- Try to access files outside workspace
- Get frustrated with permission requests (they're for your safety!)

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open AI Copilot | `Ctrl+K` or `Cmd+K` |
| Send Message | `Enter` |
| New Line | `Shift+Enter` |
| Clear Chat | Click trash icon |

## Common Workflows

### 1. Research & Summary
```
1. "Find files about [topic]"
2. Approve search permission
3. "Read [specific file]"
4. Approve read permission
5. "Summarize this in the current document"
6. Review diff, accept or reject
```

### 2. Content Discovery
```
1. "Show me my workspace structure"
2. Approve file tree permission
3. "Read the [interesting file] you found"
4. Approve read permission
5. AI provides information
```

### 3. Task Management
```
1. "Search for TODO items in all files"
2. Approve content search permission
3. "Create a task list in this file"
4. Review diff with proposed changes
5. Accept to add task list
```

## Security Notes

- ✅ All operations restricted to workspace
- ✅ All tools require explicit permission
- ✅ Excluded folders: `.git`, `node_modules`, `.next`, etc.
- ✅ Markdown files only for reading
- ✅ No system file access
- ✅ No write operations without diff review

## Model Support

All tools work with:
- OpenAI GPT-4 and GPT-3.5
- Anthropic Claude (all versions)
- Google Gemini
- Other models supporting tool calling

## Need Help?

- Check [AI-Tools-Documentation.md](AI-Tools-Documentation.md) for full details
- Check [Testing-AI-Tools.md](Testing-AI-Tools.md) for test scenarios
- Report issues via GitHub

## Version

**AI Copilot v1.0** - January 2026
- Initial release with 5 core tools
- Full permission system
- Diff review for edits
- Multi-model support
