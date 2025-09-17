/*
 * Copyright 2025 Martin Bergljung
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Re-export types from the official MCP SDK
export type {
  Tool as MCPTool,
  Resource as MCPResource,
  Prompt as MCPPrompt,
  Root as MCPRoot,
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
  GetPromptResult,
  ListPromptsResult,
  ListRootsResult
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPResourceTemplate {
  name: string;
  description: string;
  uriTemplate: string;
}

export interface OAuthConfig {
  enabled: boolean;
  flow: 'authorization_code' | 'authorization_code_pkce' | 'client_credentials';
  clientId: string;
  clientSecret: string;
  authEndpoint?: string;
  tokenEndpoint?: string;
  logoutEndpoint?: string; 
  postLogoutRedirectUri?: string; 
  scope?: string;
}

export interface MCPCapabilities {
  tools: MCPTool[];
  resources: MCPResource[];
  resourceTemplates: MCPResourceTemplate[];
  prompts: MCPPrompt[];
  roots: MCPRoot[];
}

// Attachment types
// The data field can contain:
// - For regular resources: MCPResource
// - For resource templates: { template: MCPResourceTemplate, params: Record<string, any> }
// - For prompts: { prompt: MCPPrompt, args: Record<string, any> }
export interface ChatAttachment {
  id: string;
  type: 'resource' | 'prompt';
  name: string;
  description?: string;
  data: any; // Can be resource, prompt, or resource template data
  content?: string; // Extracted/processed content
}

export interface MCPLog {
  id: number;
  timestamp: Date;
  source: 'MCP' | 'LLM'; 
  type: 'tool_call' | 'resource_read' | 'prompt_get' | 'connection' | 'completion' | 'embedding' | 'chat';
  status: 'success' | 'error' | 'pending';
  operation: string;
  details: Record<string, any>;
  response?: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  attachments?: ChatAttachment[]; 
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface OpenAIResponse {
  choices: {
    message: ChatMessage;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export interface ClientState {
  mcpServerUrl: string;
  openaiApiKey: string;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export interface ChatState {
  messages: ChatMessage[];
  currentMessage: string;
  isProcessing: boolean;
}

export interface UIState {
  showSettings: boolean;
  selectedTab: 'tools' | 'resources' | 'prompts';
  showLogs: boolean;
}

export type MCPEventType = 'connected' | 'disconnected' | 'capabilitiesLoaded' | 'error';

export interface MCPEventData {
  connected?: any;
  disconnected?: void;
  capabilitiesLoaded?: MCPCapabilities;
  error?: Error;
}