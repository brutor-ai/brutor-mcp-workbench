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

import { ChatMessage, OpenAITool, OpenAIResponse, MCPTool, MCPLog } from '../types';

// Helper function to sanitize tool arguments
export function sanitizeToolArguments(toolCall: any): any {
  if (!toolCall.function?.arguments) return toolCall;

  try {
    const args = JSON.parse(toolCall.function.arguments);

    // Remove null values completely instead of converting them
    const sanitizedArgs: Record<string, any> = {};

    Object.entries(args).forEach(([key, value]) => {
      // Only include non-null, non-undefined values
      if (value !== null && value !== undefined) {
        sanitizedArgs[key] = value;
      }
    });

    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify(sanitizedArgs)
      }
    };
  } catch (e) {
    console.warn('Failed to sanitize tool arguments:', e);
    return toolCall;
  }
}

export class OpenAIClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void;
  private usingProxy: boolean;

  constructor(
    apiKey: string,
    model: string = 'gpt-4o',
    logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void,
    baseUrl?: string
  ) {
    this.model = model;
    this.logCallback = logCallback;

    // Determine if using proxy
    this.usingProxy = !!(baseUrl && baseUrl.trim());

    // Use proxy URL if provided, otherwise use env variable or default
    this.baseUrl = (baseUrl && baseUrl.trim())
      ? baseUrl.trim()
      : (import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com');

    // UPDATED: Only require API key if not using proxy
    // When using proxy, the proxy handles authentication
    if (this.usingProxy) {
      // Use a placeholder or empty string for proxy mode
      // The proxy will handle authentication
      this.apiKey = apiKey || 'proxy-mode';
      console.log('OpenAI Client initialized in PROXY mode:', {
        model: this.model,
        proxyUrl: this.baseUrl,
        note: 'API key managed by proxy server'
      });
    } else {
      // Direct mode requires API key
      if (!apiKey) {
        throw new Error('OpenAI API key is required when not using a proxy');
      }
      this.apiKey = apiKey;
      console.log('OpenAI Client initialized in DIRECT mode:', {
        model: this.model,
        baseUrl: this.baseUrl
      });
    }
  }

  setLogCallback(callback: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void) {
    this.logCallback = callback;
  }

  private log(entry: Omit<MCPLog, 'id' | 'timestamp'>) {
    if (this.logCallback) {
      this.logCallback(entry);
    }
  }

  async chat(messages: ChatMessage[], tools: OpenAITool[] = []): Promise<OpenAIResponse> {
    const requestId = Date.now().toString();

    // Log the start of the chat completion
    this.log({
      source: 'LLM',
      type: 'chat',
      status: 'pending',
      operation: 'completion',
      details: {
        model: this.model,
        messageCount: messages.length,
        toolCount: tools.length,
        requestId,
        baseUrl: this.baseUrl
      }
    });

    try {
      const requestBody = {
        model: this.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000
      };

      // UPDATED: Use this.baseUrl instead of hardcoded URL
      const apiUrl = `${this.baseUrl}/v1/chat/completions`;

      console.log('Making OpenAI API request to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = `OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`;

        // Log the error
        this.log({
          source: 'LLM',
          type: 'chat',
          status: 'error',
          operation: 'completion',
          details: {
            model: this.model,
            messageCount: messages.length,
            toolCount: tools.length,
            requestId,
            statusCode: response.status,
            baseUrl: this.baseUrl
          },
          response: { error: errorMessage }
        });

        throw new Error(errorMessage);
      }

      const data: OpenAIResponse = await response.json();

      // Log successful completion
      this.log({
        source: 'LLM',
        type: 'chat',
        status: 'success',
        operation: 'completion',
        details: {
          model: this.model,
          messageCount: messages.length,
          toolCount: tools.length,
          requestId,
          baseUrl: this.baseUrl
        },
        response: {
          model: data.model,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
          toolCalls: data.choices[0]?.message?.tool_calls?.length || 0,
          finishReason: (data.choices[0] as any)?.finish_reason
        }
      });

      return data;
    } catch (error) {
      console.error('OpenAI chat error:', error);

      // Log the error if not already logged
      if (!(error instanceof Error && error.message.includes('OpenAI API error'))) {
        this.log({
          source: 'LLM',
          type: 'chat',
          status: 'error',
          operation: 'completion',
          details: {
            model: this.model,
            messageCount: messages.length,
            toolCount: tools.length,
            requestId,
            baseUrl: this.baseUrl
          },
          response: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }

      throw error;
    }
  }

  formatToolsForOpenAI(mcpTools: MCPTool[]): OpenAITool[] {
    return mcpTools.map(tool => {
      // Get the original schema
      let schema = tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      };

      // Ensure schema has proper structure for OpenAI
      if (schema.type === 'object' && !schema.properties) {
        schema.properties = {};
      }

      // Create a clean copy of the schema without adding problematic defaults
      const cleanSchema = {
        type: schema.type,
        properties: { ...schema.properties },
        required: schema.required || []
      };

      // Clean up the properties without adding defaults that cause null values
      if (cleanSchema.properties) {
        Object.keys(cleanSchema.properties).forEach(key => {
          const prop = { ...cleanSchema.properties[key] };

          // For boolean properties, don't add defaults for optional parameters
          if (prop.type === 'boolean') {
            // Only keep explicit defaults that were in the original schema
            if (prop.default === undefined && !cleanSchema.required.includes(key)) {
              // Don't add a default - let OpenAI handle optional booleans naturally
            }
          }

          cleanSchema.properties[key] = prop;
        });
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: cleanSchema
        }
      };
    });
  }
}