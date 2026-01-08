"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import type { PendingChange, ToolPermissionRequest } from "@/types";
import { ToolPermissionDialog } from "./tool-permission-dialog";
import {
  Bot,
  User,
  Send,
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  FileEdit,
  AlertCircle,
  Check,
  Copy,
  Trash2,
  RefreshCw,
  Settings2,
  CheckCircle2,
  XCircle,
  Info,
  GitCompare,
} from "lucide-react";

// Toast notification types and component
type ToastType = "success" | "error" | "info";
interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

function Toast({ toast, onDismiss }: { toast: ToastNotification; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const colors = {
    success: "border-green-500 bg-green-50 dark:bg-green-900/20",
    error: "border-red-500 bg-red-50 dark:bg-red-900/20",
    info: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg",
        colors[toast.type]
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100">{toast.title}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastNotification[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Import centralized model configuration
import {
  MODELS,
  getModelsGroupedByProvider,
  PROVIDER_DISPLAY_NAMES,
  DEFAULT_MODEL_ID,
  type ModelConfig,
  type Provider,
} from "@/lib/models";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilePath: string | null;
  selectedText: string;
  onFileUpdated: () => void;
  /** Increment this to force the editor to re-render with fresh content */
  onForceEditorRefresh?: () => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  currentFilePath,
  selectedText: selectedTextProp,
  onFileUpdated,
  onForceEditorRefresh,
}: ChatPanelProps) {
  // Get editorContent directly from store to ensure we always have the latest content
  // The editor syncs content to the store on every change, so this is always up-to-date
  const { setEditorContent, setIsDirty, settings, setPendingChange, editorContent: storeEditorContent } = useAppStore();

  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [toolStatus, setToolStatus] = useState<
    "idle" | "running" | "success" | "error" | "proposal"
  >("idle");
  const [inputValue, setInputValue] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [pendingPermission, setPendingPermission] = useState<ToolPermissionRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Toast helpers
  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Use the prop selected text when it changes
  useEffect(() => {
    if (selectedTextProp) {
      setSelectedText(selectedTextProp);
    }
  }, [selectedTextProp]);

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: async ({ message }) => {
      // Check if any tool parts were made
      const toolParts = message.parts.filter((part) =>
        part.type.startsWith("tool-")
      );

      if (toolParts.length > 0) {
        // Check for permission requests from any tool
        for (const part of toolParts) {
          // Type guard for tool parts with output
          if (
            part.type.startsWith("tool-") &&
            "state" in part &&
            "output" in part &&
            part.state === "output-available" &&
            part.output &&
            typeof part.output === "object" &&
            "requiresPermission" in part.output &&
            part.output.requiresPermission
          ) {
            const output = part.output as {
              requiresPermission: boolean;
              permissionRequest?: {
                toolName?: string;
                action?: string;
                reason?: string;
                filePath?: string;
                pattern?: string;
                query?: string;
                filePattern?: string;
              };
            };

            const permissionRequest: ToolPermissionRequest = {
              id: Date.now().toString(),
              toolName: output.permissionRequest?.toolName || part.type.replace("tool-", ""),
              action: output.permissionRequest?.action || "execute",
              reason: output.permissionRequest?.reason || "No reason provided",
              parameters: {
                filePath: output.permissionRequest?.filePath,
                pattern: output.permissionRequest?.pattern,
                query: output.permissionRequest?.query,
                filePattern: output.permissionRequest?.filePattern,
                ...output.permissionRequest,
              },
              timestamp: Date.now(),
              status: "pending",
            };
            setPendingPermission(permissionRequest);
            addToast("info", "Permission Required", "The AI is requesting permission to use a tool");
            return; // Stop processing other parts until permission is handled
          }
        }

        // Check for proposeDocumentChange tool (new diff workflow)
        const proposalPart = toolParts.find(
          (part) => part.type === "tool-proposeDocumentChange"
        ) as
          | { 
              state?: string; 
              output?: { 
                success: boolean;
                type?: "proposal" | "error";
                message?: string; 
                proposedContent?: string;
                path?: string;
                summary?: string;
                error?: string;
                hint?: string;
              }; 
              type: string 
            }
          | undefined;

        if (proposalPart) {
          console.log("[ChatPanel] Proposal tool result received:", proposalPart);
          
          if (
            proposalPart.state === "output-available" &&
            proposalPart.output?.success &&
            proposalPart.output?.type === "proposal"
          ) {
            setToolStatus("proposal");
            
            // Create the pending change for diff review
            // Use Zustand's getState() to get the absolutely latest editor content
            // This avoids any stale closure issues since we read directly from the store
            const currentContent = useAppStore.getState().editorContent;
            console.log("[ChatPanel] Using latest editor content for diff (length:", currentContent.length, ")");
            
            const pendingChange: PendingChange = {
              filePath: proposalPart.output.path || currentFilePath || "",
              originalContent: currentContent,
              proposedContent: proposalPart.output.proposedContent || "",
              summary: proposalPart.output.summary || "AI proposed changes",
              timestamp: Date.now(),
            };
            
            console.log("[ChatPanel] Setting pending change for diff review");
            setPendingChange(pendingChange);
            
            // Show info toast
            addToast(
              "info",
              "Changes Proposed",
              "Review the proposed changes and Accept or Reject them"
            );

            // Reset status after a short delay (the diff panel is now visible)
            setTimeout(() => setToolStatus("idle"), 2000);
            
          } else if (proposalPart.state === "output-available" && !proposalPart.output?.success) {
            // Tool executed but reported failure
            setToolStatus("error");
            addToast(
              "error",
              "Proposal Failed",
              proposalPart.output?.error || "Unknown error occurred"
            );
            if (proposalPart.output?.hint) {
              console.warn("[ChatPanel] Hint:", proposalPart.output.hint);
            }
            setTimeout(() => setToolStatus("idle"), 3000);
          } else if (proposalPart.state === "output-error") {
            setToolStatus("error");
            addToast("error", "Tool Error", "The proposal tool encountered an error");
            setTimeout(() => setToolStatus("idle"), 3000);
          }
        }
      }
    },
    onError: (err) => {
      console.error("[ChatPanel] Chat error:", err);
      setToolStatus("error");
      addToast("error", "Chat Error", err.message || "An error occurred");
      setTimeout(() => setToolStatus("idle"), 3000);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";


  // Auto-scroll to bottom on new messages and during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Continuous scroll during streaming (messages content updates)
  useEffect(() => {
    if (status === "streaming") {
      const scrollInterval = setInterval(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [status]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Handle form submission
  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      // Use Zustand's getState() to get the absolutely latest editor content at submission time
      // This ensures the AI always receives the current content, not a stale closure value
      const latestContent = useAppStore.getState().editorContent;
      console.log("[ChatPanel] Sending message with content length:", latestContent.length);
      
      sendMessage(
        { text: inputValue },
        {
          body: {
            model: selectedModel,
            filePath: currentFilePath,
            fileContent: latestContent,
            selectedText: selectedText || undefined,
            rootDirectory: settings.rootDirectory,
          },
        }
      );
      setInputValue("");
      // Clear selected text after sending
      setSelectedText("");
    },
    [inputValue, isLoading, sendMessage, selectedModel, currentFilePath, selectedText, settings.rootDirectory]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    },
    [onSubmit]
  );

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setToolStatus("idle");
  }, [setMessages]);

  // Handle tool permission approval
  const handlePermissionApprove = useCallback(async () => {
    if (!pendingPermission) return;

    try {
      // Execute the tool with approved permissions
      const response = await fetch("/api/chat/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: pendingPermission.toolName,
          parameters: pendingPermission.parameters,
          rootDirectory: settings.rootDirectory,
        }),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Tool Executed", `${pendingPermission.toolName} completed successfully`);
        
        // Send the result back to the AI in the conversation
        const resultMessage = `Tool "${pendingPermission.toolName}" executed successfully. Result: ${JSON.stringify(result.data, null, 2)}`;
        sendMessage(
          { text: resultMessage },
          {
            body: {
              model: selectedModel,
              filePath: currentFilePath,
              fileContent: useAppStore.getState().editorContent,
              rootDirectory: settings.rootDirectory,
            },
          }
        );
      } else {
        addToast("error", "Tool Failed", result.error || "Unknown error");
      }
    } catch (error) {
      addToast("error", "Execution Error", error instanceof Error ? error.message : "Failed to execute tool");
    } finally {
      setPendingPermission(null);
    }
  }, [pendingPermission, settings.rootDirectory, addToast, sendMessage, selectedModel, currentFilePath]);

  // Handle tool permission denial
  const handlePermissionDeny = useCallback(() => {
    if (!pendingPermission) return;
    
    addToast("info", "Permission Denied", `Access to ${pendingPermission.toolName} was denied`);
    
    // Notify the AI that permission was denied
    const denialMessage = `Permission denied for tool "${pendingPermission.toolName}". The user did not approve the request.`;
    sendMessage(
      { text: denialMessage },
      {
        body: {
          model: selectedModel,
          filePath: currentFilePath,
          fileContent: useAppStore.getState().editorContent,
          rootDirectory: settings.rootDirectory,
        },
      }
    );
    
    setPendingPermission(null);
  }, [pendingPermission, addToast, sendMessage, selectedModel, currentFilePath, settings.rootDirectory]);

  return (
    <>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Tool Permission Dialog */}
      <ToolPermissionDialog
        request={pendingPermission}
        onApprove={handlePermissionApprove}
        onDeny={handlePermissionDeny}
      />
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-96 flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
          >
            {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                AI Copilot
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5 text-gray-400" />
                  {MODELS.find((m) => m.id === selectedModel)?.name ||
                    selectedModel}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-gray-400 transition-transform",
                    showModelSelector && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence>
                {showModelSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-10 max-h-80 overflow-y-auto"
                  >
                    {(Object.keys(getModelsGroupedByProvider()) as Provider[]).map((provider) => {
                      const providerModels = getModelsGroupedByProvider()[provider];
                      if (providerModels.length === 0) return null;
                      return (
                        <div key={provider}>
                          {/* Provider Group Header */}
                          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 uppercase tracking-wider sticky top-0">
                            {PROVIDER_DISPLAY_NAMES[provider]}
                          </div>
                          {/* Models in this provider group */}
                          {providerModels.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setShowModelSelector(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col gap-0.5",
                                selectedModel === model.id &&
                                  "bg-violet-50 dark:bg-violet-900/20"
                              )}
                            >
                              <span className="font-medium">{model.name}</span>
                              {model.description && (
                                <span className="text-xs text-gray-400">
                                  {model.description}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Context Indicator */}
          {(currentFilePath || selectedText) && (
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 space-y-1">
              {currentFilePath && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileEdit className="h-3 w-3" />
                  <span className="truncate">
                    {currentFilePath.split(/[\\/]/).pop()}
                  </span>
                </div>
              )}
              {selectedText && (
                <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                  <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 rounded">
                    Selection: {selectedText.length} chars
                  </span>
                  <button
                    onClick={() => setSelectedText("")}
                    className="hover:text-violet-800 dark:hover:text-violet-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tool Status Indicator */}
          <AnimatePresence>
            {toolStatus !== "idle" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={cn(
                    "px-4 py-2 text-sm flex items-center gap-2",
                    toolStatus === "running" &&
                      "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
                    toolStatus === "success" &&
                      "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
                    toolStatus === "error" &&
                      "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  )}
                >
                  {toolStatus === "running" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Applying changes...</span>
                    </>
                  )}
                  {toolStatus === "success" && (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Changes applied successfully</span>
                    </>
                  )}
                  {toolStatus === "error" && (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <span>Failed to apply changes</span>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="p-3 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-2xl mb-4">
                  <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  AI Writing Assistant
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Ask me to explain, edit, summarize, or improve your markdown
                  content.
                </p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>&quot;Summarize this document&quot;</p>
                  <p>&quot;Fix the formatting in my table&quot;</p>
                  <p>&quot;Add a conclusion section&quot;</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error</p>
                  <p className="text-xs mt-1">{error.message}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={onSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentFilePath
                    ? "Ask about this file..."
                    : "Open a file to get started..."
                }
                disabled={!currentFilePath}
                rows={3}
                className="w-full px-4 py-3 pr-12 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || !currentFilePath}
                className="absolute right-3 bottom-3 p-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

// Chat message component
function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 px-4 py-3 rounded-2xl text-sm max-w-[calc(100%-3rem)]",
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
        )}
      >
        {message.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <MessageContent
                  key={index}
                  content={part.text}
                  isUser={isUser}
                />
              );
            case "tool-updateDocument":
              return (
                <div
                  key={index}
                  className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  <FileEdit className="h-3 w-3" />
                  <span>
                    {part.state === "output-available" ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Document updated
                      </span>
                    ) : part.state === "output-error" ? (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ Update failed
                      </span>
                    ) : (
                      <span>Updating document...</span>
                    )}
                  </span>
                </div>
              );
            default:
              // Handle dynamic tools or other tool types
              if (part.type.startsWith("tool-")) {
                return (
                  <div
                    key={index}
                    className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <FileEdit className="h-3 w-3" />
                    <span>Tool: {part.type.replace("tool-", "")}</span>
                  </div>
                );
              }
              return null;
          }
        })}
      </div>
    </motion.div>
  );
}

// Code block component with copy button and syntax highlighting
function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group my-3 -mx-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 dark:bg-gray-900 rounded-t-lg border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors rounded"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: "0.5rem",
          borderBottomRightRadius: "0.5rem",
          fontSize: "0.75rem",
          lineHeight: "1.5",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// Markdown rendering for message content
function MessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  // For user messages, just render plain text with whitespace preserved
  if (isUser) {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  // For AI messages, render with full markdown support
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-0 prose-pre:p-0 prose-pre:bg-transparent">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match ? match[1] : ""}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          // Override pre to avoid double wrapping
          pre({ children }) {
            return <>{children}</>;
          },
          // Links open in new tab
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                {children}
              </a>
            );
          },
          // Paragraphs with proper spacing
          p({ children }) {
            return <p className="my-2 leading-relaxed">{children}</p>;
          },
          // Lists with proper styling
          ul({ children }) {
            return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
          },
          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-violet-400 pl-4 my-3 italic text-gray-600 dark:text-gray-400">
                {children}
              </blockquote>
            );
          },
          // Tables with styling
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
