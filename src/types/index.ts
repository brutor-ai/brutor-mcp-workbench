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

// ============================================================================
// BASE MCP TYPES (from official MCP SDK)
// ============================================================================

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

// ============================================================================
// MULTI-SERVER CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for a single MCP server
 */
export interface ServerConfig {
    id: string;                    // Unique identifier for this server
    name: string;                  // Display name (e.g., "GitHub MCP Server")
    description?: string;          // Optional description of what this server provides
    baseUrl: string;               // Base URL (e.g., "http://localhost:3000")
    endpointPath: string;          // Endpoint path (e.g., "/api/mcp")
    endpointSameAsBase: boolean;   // If true, use baseUrl as complete MCP URL
    oauth: OAuthConfig;            // OAuth configuration for this server
    enablePortCheck: boolean;      // Pre-connection port check
    enableCorsCheck: boolean;      // Pre-connection CORS check
    enableHealthCheck: boolean;    // Pre-connection health check
    color?: string;                // UI color for visual distinction (e.g., 'blue', 'green')
    icon?: string;                 // Optional icon identifier
    tags?: string[];               // Optional tags for categorization
    enabled: boolean;              // Whether this server should auto-connect
}

/**
 * Runtime connection state for a server
 */
export interface ServerConnection {
    serverId: string;              // Links to ServerConfig.id
    serverName: string;            // Cached from ServerConfig for convenience
    connected: boolean;            // Is currently connected
    loading: boolean;              // Is currently connecting
    capabilities: MCPCapabilities; // Capabilities from this server
    mcpClient: any | null;         // MCPClient instance
    tokenManager: any | null;      // OAuthTokenManager instance
    lastConnected?: Date;          // Last successful connection timestamp
    error?: string;                // Last connection error if any
}

export enum OAuthFlow {
    AuthorizationCode = 'authorization_code',
    AuthorizationCodePKCE = 'authorization_code_pkce',
    ClientCredentials = 'client_credentials'
}

/**
 * OAuth configuration for a server
 */
export interface OAuthConfig {
    enabled: boolean;
    flow: OAuthFlow;
    clientId: string;
    clientSecret: string;
    authEndpoint?: string;
    tokenEndpoint?: string;
    logoutEndpoint?: string;
    postLogoutRedirectUri?: string;
    scope?: string;
}

// ============================================================================
// CAPABILITY TYPES
// ============================================================================

/**
 * Base capabilities from a single MCP server
 */
export interface MCPCapabilities {
    tools: MCPTool[];
    resources: MCPResource[];
    resourceTemplates: MCPResourceTemplate[];
    prompts: MCPPrompt[];
    roots: MCPRoot[];
}

/**
 * Resource template type (not in base MCP SDK)
 */
export interface MCPResourceTemplate {
    name: string;
    description: string;
    uriTemplate: string;  // e.g., "/users/{userId}/posts/{postId}"
}

// ============================================================================
// SERVER-ATTRIBUTED CAPABILITY TYPES
// ============================================================================

/**
 * Tool with server attribution for multi-server aggregation
 */
export interface ServerAttributedTool extends MCPTool {
    serverId: string;      // Which server provides this tool
    serverName: string;    // Display name of the server
    serverColor?: string;  // UI color for server badge
}

/**
 * Resource with server attribution
 */
export interface ServerAttributedResource extends MCPResource {
    serverId: string;
    serverName: string;
    serverColor?: string;
}

/**
 * Prompt with server attribution
 */
export interface ServerAttributedPrompt extends MCPPrompt {
    serverId: string;
    serverName: string;
    serverColor?: string;
}

/**
 * Resource template with server attribution
 */
export interface ServerAttributedResourceTemplate extends MCPResourceTemplate {
    serverId: string;
    serverName: string;
    serverColor?: string;
}

/**
 * Aggregated capabilities from ALL connected servers
 * This is what the LLM sees - a unified view of all capabilities
 */
export interface AggregatedCapabilities {
    tools: ServerAttributedTool[];                    // All tools from all servers
    resources: ServerAttributedResource[];            // All resources from all servers
    prompts: ServerAttributedPrompt[];                // All prompts from all servers
    resourceTemplates: ServerAttributedResourceTemplate[]; // All templates from all servers
    roots: MCPRoot[];                                 // All roots from all servers
    serverCount: number;                              // Number of connected servers
    byServer: Map<string, MCPCapabilities>;          // Capabilities grouped by server
}

// ============================================================================
// CHAT TYPES
// ============================================================================

/**
 * Base chat message
 */
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_call_id?: string;        // For tool response messages
    tool_calls?: ToolCall[];      // For assistant messages requesting tool calls
    attachments?: ChatAttachment[]; // For user messages with attached resources/prompts
}

/**
 * Tool call structure (from OpenAI format)
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;  // JSON string
    };
}

/**
 * Chat attachment (resource or prompt attached to a message)
 * CRITICAL: Includes serverId to track which server this came from
 */
export interface ChatAttachment {
    id: string;
    type: 'resource' | 'prompt';
    name: string;
    description?: string;
    data: any;              // Can be resource, prompt, or resource template data
    content?: string;       // Extracted/processed content
    serverId: string;       // REQUIRED: Which server this attachment came from
    serverName: string;     // Display name of server for UI badges
    serverColor?: string;   // Optional color for UI badges
}

// ============================================================================
// OPENAI INTEGRATION TYPES
// ============================================================================

/**
 * OpenAI tool format
 */
export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

/**
 * OpenAI API response
 */
export interface OpenAIResponse {
    choices: {
        message: ChatMessage;
        finish_reason?: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model?: string;
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

/**
 * Log entry for activity tracking
 * Extended to include server context for multi-server operations
 */
export interface MCPLog {
    id: string | number;
    timestamp: Date;
    source: 'MCP' | 'LLM';
    type: 'tool_call' | 'resource_read' | 'prompt_get' | 'connection' | 'completion' | 'embedding' | 'chat';
    status: 'success' | 'error' | 'pending';
    operation: string;
    details: Record<string, any>;
    response?: Record<string, any>;
    serverId?: string;      // Which server this log entry relates to
    serverName?: string;    // Display name for UI
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * MCP event types
 */
export type MCPEventType = 'connected' | 'disconnected' | 'capabilitiesLoaded' | 'error' | 'preConnectionTests';

// ============================================================================
// UTILITY TYPES
// ============================================================================


/**
 * Tool routing result - includes which server handled the tool call
 */
export interface ToolRoutingResult {
    result: any;            // The actual tool result
    serverId: string;       // Which server handled this
    serverName: string;     // Display name of server
    duration?: number;      // Optional timing information
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Return type for useMCPServers hook
 */
export interface UseMCPServersReturn {
    // Server management
    servers: ServerConfig[];
    addServer: (config: Omit<ServerConfig, 'id'>) => string;
    updateServer: (serverId: string, updates: Partial<ServerConfig>) => void;
    removeServer: (serverId: string) => Promise<void>;

    // Connection management
    connections: ServerConnection[];
    connectToServer: (
        serverId: string,
        apiKey: string,
        model?: string,
        logCallback?: any,
        proxyUrl?: string  // ← Added proxy URL parameter
    ) => Promise<boolean>;
    disconnectServer: (serverId: string, performOAuthLogout?: boolean) => Promise<void>;
    disconnectAll: () => Promise<void>;
    clearServerError: (serverId: string) => void;

    // Aggregated capabilities
    aggregatedCapabilities: AggregatedCapabilities;

    // Server-specific operations
    getConnection: (serverId: string) => ServerConnection | null;
    getConnectedServers: () => Array<{ serverId: string; config: ServerConfig; connection: ServerConnection }>;
    routeToolCall: (toolName: string, args: any) => Promise<ToolRoutingResult>;
    readResourceFromServer: (serverId: string, uri: string) => Promise<any>;
    getPromptFromServer: (serverId: string, name: string, args?: any) => Promise<any>;

    // OpenAI client
    openaiClient: any | null;

    // Status flags
    hasServers: boolean;
    connectedCount: number;
    isAnyLoading: boolean;
    isAnyConnected: boolean;
}
