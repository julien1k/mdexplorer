"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSearch,
  FolderSearch,
  FileText,
  FolderTree,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolPermissionRequest } from "@/types";

interface ToolPermissionDialogProps {
  request: ToolPermissionRequest | null;
  onApprove: () => void;
  onDeny: () => void;
}

const toolIcons = {
  readMarkdownFile: FileText,
  searchMarkdownFiles: FolderSearch,
  searchMarkdownContent: FileSearch,
  listFileTree: FolderTree,
};

const toolLabels = {
  readMarkdownFile: "Read Markdown File",
  searchMarkdownFiles: "Search for Markdown Files",
  searchMarkdownContent: "Search File Contents",
  listFileTree: "View File Tree",
};

const toolDescriptions = {
  readMarkdownFile: "The AI assistant wants to read the contents of a markdown file.",
  searchMarkdownFiles: "The AI assistant wants to search for markdown files in your workspace.",
  searchMarkdownContent: "The AI assistant wants to search for text within markdown files.",
  listFileTree: "The AI assistant wants to view your workspace file structure.",
};

export function ToolPermissionDialog({
  request,
  onApprove,
  onDeny,
}: ToolPermissionDialogProps) {
  if (!request) return null;

  const Icon = toolIcons[request.toolName as keyof typeof toolIcons] || AlertCircle;
  const label = toolLabels[request.toolName as keyof typeof toolLabels] || request.toolName;
  const description = toolDescriptions[request.toolName as keyof typeof toolDescriptions] || "The AI wants to perform an action.";

  // Filter out undefined, null, empty string, and metadata parameters
  const relevantParams = Object.entries(request.parameters).filter(
    ([key, value]) => 
      value !== undefined && 
      value !== null && 
      value !== "" &&
      key !== "toolName" &&
      key !== "action" &&
      key !== "reason"
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onDeny}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Permission Required
                </h3>
                <p className="text-blue-100 text-sm">{label}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Description */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {description}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason:
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-900 dark:text-gray-100 italic">
                  "{request.reason}"
                </p>
              </div>
            </div>

            {/* Details */}
            {relevantParams.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Parameters:
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <dl className="space-y-1.5">
                    {relevantParams.map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded break-all">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {/* Info notice */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                All tool permissions are requested for your safety and transparency.
                You can approve or deny this request.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onDeny}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium",
                "bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-50 dark:hover:bg-gray-700",
                "transition-colors duration-200"
              )}
            >
              <XCircle className="h-4 w-4" />
              Deny
            </button>
            <button
              onClick={onApprove}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium",
                "bg-gradient-to-r from-blue-500 to-purple-600",
                "text-white shadow-lg",
                "hover:from-blue-600 hover:to-purple-700",
                "transition-all duration-200"
              )}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
