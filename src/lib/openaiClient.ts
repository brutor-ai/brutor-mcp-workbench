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
  private logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void;

  constructor(apiKey: string, model: string = 'gpt-4o', logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void) {
    this.apiKey = apiKey;
    this.model = model;
    this.logCallback = logCallback;
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
        requestId
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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            statusCode: response.status
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
          requestId
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
            requestId
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