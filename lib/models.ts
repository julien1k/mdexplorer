/**
 * Centralized AI Model Configuration
 *
 * This file exports all available AI models, their display names, and provider instances.
 * Using a factory pattern for clean provider resolution in the API route.
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// Provider types
export type Provider = "openai" | "anthropic" | "google";

// Model configuration interface
export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  description?: string;
}

// All available models grouped by provider
export const MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    description: "Latest flagship model with advanced reasoning",
  },
  {
    id: "gpt-5.2-turbo",
    name: "GPT-5.2 Turbo",
    provider: "openai",
    description: "Faster variant of GPT-5.2",
  },
  {
    id: "o3-preview",
    name: "O3 Preview",
    provider: "openai",
    description: "Next-gen reasoning model (preview)",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Multimodal model with vision capabilities",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Fast and cost-effective",
  },

  // Anthropic Models
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Latest Claude model with enhanced capabilities",
  },
  {
    id: "claude-3-5-sonnet-latest",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description: "Balanced performance and speed",
  },

  // Google Gemini Models
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    description: "Most advanced Gemini model (preview)",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    description: "Fast next-gen Gemini model (preview)",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Latest stable Gemini with enhanced reasoning",
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Fast and cost-effective",
  },
];

// Get all allowed model IDs
export const ALLOWED_MODEL_IDS = MODELS.map((m) => m.id);

// Type for model IDs
export type ModelId = (typeof ALLOWED_MODEL_IDS)[number];

// Helper to check if a model ID is valid
export function isValidModelId(modelId: string): modelId is ModelId {
  return ALLOWED_MODEL_IDS.includes(modelId);
}

// Get model config by ID
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === modelId);
}

// Get models grouped by provider (for UI dropdown)
export function getModelsGroupedByProvider(): Record<Provider, ModelConfig[]> {
  return {
    openai: MODELS.filter((m) => m.provider === "openai"),
    anthropic: MODELS.filter((m) => m.provider === "anthropic"),
    google: MODELS.filter((m) => m.provider === "google"),
  };
}

// Provider display names for UI
export const PROVIDER_DISPLAY_NAMES: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

/**
 * Factory function to get the model instance for a given model ID.
 * This centralizes provider resolution and keeps the API route clean.
 */
export function getModelInstance(modelId: string): LanguageModel {
  const config = getModelConfig(modelId);

  if (!config) {
    // Fallback to OpenAI if model not found
    console.warn(`[models] Unknown model ID: ${modelId}, falling back to gpt-4o-mini`);
    return openai("gpt-4o-mini");
  }

  switch (config.provider) {
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
    case "google":
      return google(modelId);
    default:
      // TypeScript exhaustive check
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
  }
}

/**
 * Get provider name from model ID
 */
export function getProviderFromModelId(modelId: string): Provider {
  const config = getModelConfig(modelId);
  return config?.provider ?? "openai";
}

// Default model for new chats
export const DEFAULT_MODEL_ID: ModelId = "gemini-3-flash-preview";
