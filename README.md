# MD Explorer 📝

A **Notion-style local Markdown editor** and file browser built with Next.js (App Router), TypeScript, and BlockNote. Features an integrated **AI Copilot** powered by the Vercel AI SDK for writing assistance.

![MD Explorer](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![Vercel AI SDK](https://img.shields.io/badge/AI%20SDK-6-purple?style=flat-square)

## ✨ Features

### 🤖 AI Copilot

- **Writing assistant** - Get help with summarizing, editing, reformatting, and improving your markdown
- **Direct document editing** - The AI can modify your files directly using the `updateDocument` tool
- **Model selection** - Choose between GPT-4o Mini and GPT-5 Mini (OpenAI)
- **Context-aware** - The AI sees your current file content and any selected text
- **Streaming responses** - Real-time streaming for a responsive chat experience

### 📁 File Browser

- **Recursive file tree** - Browse your local files in an expandable sidebar
- **Smart file handling** - Markdown files open in the editor, other files open in their default app
- **Folder exploration** - Double-click folders to open them in File Explorer (Windows), Finder (macOS), or your file manager (Linux)

### ✏️ Block-Based Editor

- **Notion-style editing** - Powered by BlockNote.js for a familiar block-based experience
- **Autosave** - Changes are automatically saved after a 1.5-second debounce
- **Rich formatting** - Support for headings, lists, code blocks, and more
- **Collapsible headings** - Toggle outline mode to collapse content under headings

### ⌨️ Command Palette

Press `Ctrl + K` (or `Cmd + K` on Mac) to access:

- **Recent Files** - Browse and open recently accessed documents
- **Search Files** - Quick file search across your documents
- **Save File** - Manually save current document
- **Toggle All Headings** - Collapse/expand heading sections
- **New Markdown File** - Create a new markdown file
- **Settings** - Open the configuration settings
- **Switch Root** - Change the active document directory

### 🕒 Recent Files

- **Quick Access** - Quickly jump to your recently opened files
- **Command Palette Integration** - Access recent files directly from the command palette (`Ctrl + K`)

### ⚙️ Settings & Customization

- **Root Directory** - Change your document root folder directly from the UI
- **Exclusions** - Configure files and folders to hide from the file explorer
- **Settings Modal** - Easy access to configuration via the gear icon or command palette

### 🖱️ Context Menu

Right-click on files or folders to access:
- **File Operations** - Rename, delete, and duplicate files
- **System Integration** - Copy file paths or open in your OS file manager
- **Creation** - Create new files and folders at specific locations

### 📝 Diff Review

- **AI Change Review** - Visual diff interface for reviewing AI-suggested changes
- **Accept/Reject** - Selectively apply or discard AI modifications

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mdexplorer

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

You can configure MD Explorer in two ways:

1. **Settings UI**: Click the gear icon or use the Command Palette (`Ctrl + K` > Settings) to configure:
   - Root Directory
   - Excluded Files/Folders

2. **Environment Variables**: Set defaults using `.env.local`:

```bash
# .env.local
MD_EXPLORER_ROOT=/path/to/your/documents
```

### AI Copilot Setup

To enable the AI Copilot, you need API keys for the providers you want to use. Add them to your `.env.local` file:

```bash
# .env.local

# OpenAI (required for GPT models)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (required for Claude models)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Google (required for Gemini models)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key-here
```

You can obtain API keys from:

- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic:** [console.anthropic.com](https://console.anthropic.com/)
- **Google:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

> **Tip:** Copy `.env.local.example` to `.env.local` and fill in the values for the providers you want to use. You only need keys for the providers whose models you plan to use.

## 📁 Project Structure

```
mdexplorer/
├── actions/
│   ├── file-actions.ts          # Server actions for file operations
│   ├── file-management-actions.ts # CRUD operations for files/folders
│   ├── recent-files-actions.ts  # Recent files tracking
│   └── settings-actions.ts      # Settings persistence
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts         # AI Copilot API endpoint
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout with providers
│   └── page.tsx                 # Main application page
├── components/
│   ├── chat-panel.tsx           # AI Copilot sidebar panel
│   ├── command-palette.tsx      # Cmd+K command palette
│   ├── confirmation-dialog.tsx  # Delete confirmation modal
│   ├── context-menu.tsx         # Right-click context menu
│   ├── file-tree.tsx            # Recursive file tree with DnD
│   ├── markdown-editor.tsx      # BlockNote editor wrapper
│   └── settings-modal.tsx       # Settings configuration
├── stores/
│   └── app-store.ts             # Zustand global state
├── documents/                   # Default document storage
├── hooks/
│   └── use-debounce.ts          # Debounce hook for autosave
├── lib/
│   ├── config.ts                # Configuration constants
│   └── utils.ts                 # Utility functions
└── types/
    └── index.ts                 # TypeScript type definitions
```

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Editor:** [BlockNote.js](https://www.blocknotejs.org/)
- **AI Integration:** [Vercel AI SDK 6](https://ai-sdk.dev/) with OpenAI
- **Command Palette:** [cmdk](https://cmdk.paco.me/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 🤖 AI Copilot - Deep Dive

The AI Copilot is an integrated writing assistant that helps you work with your markdown documents. It appears as a slide-in panel on the right side of the editor.

### Opening the Copilot

Click the **✨ sparkles icon** in the header toolbar, or look for the purple "AI Copilot" button to toggle the panel.

### Available Models

MD Explorer supports multiple AI providers and models. Select your preferred model from the dropdown in the chat panel.

#### Supported Models

| Model | Provider | Description |
|-------|----------|-------------|
| **GPT-5.2** | OpenAI | Latest flagship model with advanced reasoning |
| **GPT-5.2 Turbo** | OpenAI | Faster variant of GPT-5.2 |
| **O3 Preview** | OpenAI | Next-gen reasoning model (preview) |
| **GPT-4o** | OpenAI | Multimodal model with vision capabilities |
| **GPT-4o Mini** | OpenAI | Fast and cost-effective |
| **Claude Sonnet 4** | Anthropic | Latest Claude model with enhanced capabilities |
| **Claude 3.5 Sonnet** | Anthropic | Balanced performance and speed |
| **Gemini 3 Pro Preview** | Google | Most advanced Gemini model (preview) |
| **Gemini 3 Flash Preview** | Google | Fast next-gen Gemini model (preview) |
| **Gemini 2.5 Pro** | Google | Latest stable Gemini with enhanced reasoning |
| **Gemini 2.0 Flash** | Google | Fast and cost-effective |

You can switch models at any time using the dropdown selector at the top of the chat panel. Models are grouped by provider for easy navigation.

### What the AI Can Do

1. **Summarize** - Ask for summaries of your document or specific sections
2. **Edit & Rewrite** - Request improvements, tone changes, or complete rewrites
3. **Format** - Fix markdown formatting, create tables, add structure
4. **Explain** - Get explanations of technical content
5. **Generate** - Create new content like conclusions, introductions, or lists
6. **Direct Editing** - The AI can modify your file directly using the `updateDocument` tool

### The `updateDocument` Tool

The AI has access to a special tool that allows it to **directly modify your current file**. When you ask the AI to make changes (e.g., "fix the typos" or "add a table of contents"), it will:

1. Analyze your request
2. Generate the complete updated document
3. Write the changes directly to disk
4. Trigger an automatic reload in the editor

You'll see a status indicator showing:

- 🔄 **"Applying changes..."** - The AI is writing to the file
- ✅ **"Changes applied successfully"** - The file was updated
- ❌ **"Failed to apply changes"** - An error occurred

> **Note:** The tool overwrites the entire file, so the AI must provide complete content, not just the changed portions.

---

## 📤 AI Context: What Gets Sent

Understanding what information the AI receives is important for privacy and effective usage.

### ✅ Sent to the AI

| Data | Description | When Sent |
|------|-------------|-----------|
| **Current File Path** | The absolute path of the open file | Always (if a file is open) |
| **Current File Content** | The full markdown content of the open file | Always (if a file is open) |
| **Selected Text** | Any text you've highlighted in the editor | Only when text is selected |
| **Chat History** | All messages in the current chat session | Always |
| **Root Directory** | Your configured documents root path | Always (for security validation) |
| **Model Selection** | Which AI model you've chosen | Always |

### ❌ NOT Sent to the AI

| Data | Why Not |
|------|---------|
| **Other files in your workspace** | The AI only sees the currently open file |
| **File tree structure** | Directory listings are not included |
| **Settings/preferences** | Your app settings are not shared |
| **Previous chat sessions** | Each chat session starts fresh |
| **System information** | No OS, user, or machine details |
| **Files outside root directory** | Security boundary prevents access |

### Context Example

When you send a message, the AI receives a system prompt structured like this:

```
[System prompt with capabilities and guidelines]

---

## Current File
**Path:** `C:\Users\You\Documents\notes.md`

**Content:**
```markdown
# My Notes
This is my document content...
```

## Selected Text (if any)

The user has highlighted the following text:

```
specific selected portion
```

### Privacy Considerations

- **Local Processing:** File operations happen on your machine via Next.js Server Actions
- **API Calls:** Only the context described above is sent to OpenAI's API
- **No Persistence:** OpenAI does not store your data for training (per their API terms)
- **Security:** Path validation ensures the AI can only modify files within your configured root directory

---

## ⚡ Key Features Implementation

### File System Operations

All file system operations use Next.js Server Actions for security:

- Files are sandboxed to the configured root directory
- Path traversal attempts are blocked
- Uses Node.js `fs/promises` for async operations

### Opening External File

Non-markdown files and folders are opened using platform-specific commands:

- **Windows:** `start` / `explorer`
- **macOS:** `open`
- **Linux:** `xdg-open`

### Autosave

The editor implements a debounced autosave:

1. Content changes trigger a 1.5-second timer
2. Timer resets on each new change
3. After the debounce period, content is converted to Markdown and saved
4. Visual feedback shows save status

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🗺️ Roadmap

### 🤖 AI Capabilities

- [ ] **Local LLM Support** - Privacy-first AI with Ollama/LM Studio
- [ ] **RAG / Knowledge Base** - Chat with your entire document library? Maybe
- [ ] **Chat History Persistence** - Save and restore conversations
- [ ] **Custom System Prompts** - Configurable AI persona
- [x] **More AI Providers** - Anthropic, Google, etc. ✅

### 📝 Editor & Knowledge Management

- [ ] **Bi-directional Linking** - `[[WikiLinks]]` and backlinks panel
- [ ] **Frontmatter & Tags** - YAML metadata support for organization
- [ ] **Multi-Format Export** - PDF, HTML, and Docx export

### ⚙️ System & Integrations

- [ ] **Git Integration** - Version control and synchronization? OneDrive / Google Drive / etc.? Maybe.
- [ ] **Keyboard Shortcuts** - Global hotkeys for Copilot and actions

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.
