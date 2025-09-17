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

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { 
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  GetPromptResult,
  ListPromptsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPTool, MCPResource, MCPResourceTemplate, MCPPrompt, MCPRoot, MCPEventType } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use local worker file (most reliable)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export class MCPClient {
  private serverBaseUrl: string;
  private mcpEndpointPath: string;
  private bearerToken: string | null = null;
  private enableHealthCheck: boolean = true;
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private connected: boolean = false;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private resourceTemplates: MCPResourceTemplate[] = [];
  private prompts: MCPPrompt[] = [];
  private roots: MCPRoot[] = [];
  private eventListeners: Record<string, Function[]> = {};

  constructor(
    serverBaseUrl: string, 
    mcpEndpointPath: string, 
    bearerToken?: string,
    enableHealthCheck: boolean = true
  ) {
    this.serverBaseUrl = serverBaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.mcpEndpointPath = mcpEndpointPath.startsWith('/') ? mcpEndpointPath : `/${mcpEndpointPath}`;
    this.bearerToken = bearerToken || null;
    this.enableHealthCheck = enableHealthCheck;
  }

  addEventListener(event: MCPEventType, callback: (data: any) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  private emit(event: MCPEventType, data?: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  async connect(): Promise<boolean> {
    try {
      console.log('Connecting to MCP server:', {
        baseUrl: this.serverBaseUrl,
        mcpPath: this.mcpEndpointPath,
        fullMcpUrl: `${this.serverBaseUrl}${this.mcpEndpointPath}`,
        enableHealthCheck: this.enableHealthCheck
      });
      
      // Test basic connectivity first (only if health check is enabled)
      if (this.enableHealthCheck) {
        await this.testConnection();
      } else {
        console.log('Health check disabled - skipping connectivity test');
      }
      
      // Create MCP client with proper configuration
      this.client = new Client({
        name: 'Brutor MCP Web Client',
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      // Create StreamableHTTP transport with the full MCP URL
      const mcpUrl = new URL(`${this.serverBaseUrl}${this.mcpEndpointPath}`);

      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      };

      if (this.bearerToken) {
        headers['Authorization'] = `Bearer ${this.bearerToken}`;
      }

      this.transport = new StreamableHTTPClientTransport(mcpUrl, {
        requestInit: {
          headers
        }
      });

      // Connect the client to the transport
      console.log('Connecting MCP client to StreamableHTTP transport...');
      await this.client.connect(this.transport);
      console.log('MCP client connected successfully');

      this.connected = true;

      // Load available capabilities after successful connection
      console.log('Loading MCP capabilities...');
      await this.loadCapabilities();
      console.log('MCP capabilities loaded successfully');

      this.emit('connected', {
        message: this.enableHealthCheck 
          ? 'Connected using StreamableHTTP transport with health check'
          : 'Connected using StreamableHTTP transport (health check skipped)',
        transportType: 'StreamableHTTP',
        serverBaseUrl: this.serverBaseUrl,
        mcpEndpointPath: this.mcpEndpointPath,
        fullMcpUrl: `${this.serverBaseUrl}${this.mcpEndpointPath}`,
        healthCheckEnabled: this.enableHealthCheck,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('MCP Connection error:', error);
      this.connected = false;

      // Cleanup on error
      if (this.client) {
        try {
          await this.client.close();
        } catch (e) {
          console.warn('Error closing client:', e);
        }
        this.client = null;
      }

      if (this.transport) {
        try {
          await this.transport.close();
        } catch (e) {
          console.warn('Error closing transport:', e);
        }
        this.transport = null;
      }

      this.emit('error', error);
      return false;
    }
  }

  private async testConnection(): Promise<void> {
    // Test basic HTTP connectivity to the server health endpoint
    const healthUrl = `${this.serverBaseUrl}/health`;
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    console.log('Testing server health at:', healthUrl);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers,
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status} ${response.statusText}`);
      }

      console.log('Health check passed');
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error(`Server health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadCapabilities(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      console.log('Starting to load capabilities...');

      // Load tools
      await this.loadTools();

      // Load resources
      await this.loadResources();

      // Load resource templates
      await this.loadResourceTemplates();

      // Load prompts
      await this.loadPrompts();

      console.log('All capabilities loaded:', {
        tools: this.tools.length,
        resources: this.resources.length,
        resourceTemplates: this.resourceTemplates.length,
        prompts: this.prompts.length
      });

      this.emit('capabilitiesLoaded', {
        tools: this.tools,
        resources: this.resources,
        resourceTemplates: this.resourceTemplates,
        prompts: this.prompts,
        roots: this.roots
      });

    } catch (error) {
      console.error('Error loading capabilities:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async loadTools(): Promise<void> {
    if (!this.client) return;

    try {
      console.log('Loading tools...');
      
      const response: ListToolsResult = await this.client.listTools();
      console.log('Raw tools response:', JSON.stringify(response, null, 2));

      if (response && response.tools) {
        this.tools = response.tools;
        console.log(`✅ Successfully loaded ${this.tools.length} tools:`, this.tools.map(t => t.name));
      } else {
        console.warn('⚠️ No tools found in response or response.tools is undefined');
        this.tools = [];
      }
    } catch (error) {
      console.error('❌ Failed to load tools:', error);
      this.tools = [];
    }
  }

  private async loadResources(): Promise<void> {
    if (!this.client) return;

    try {
      console.log('Loading resources...');

      const response: ListResourcesResult = await this.client.listResources();
      console.log('Raw resources response:', JSON.stringify(response, null, 2));

      if (response && response.resources) {
        this.resources = response.resources;
        console.log(`✅ Successfully loaded ${this.resources.length} resources:`, this.resources.map(r => r.name));
      } else {
        console.warn('⚠️ No resources found in response or response.resources is undefined');
        this.resources = [];
      }
    } catch (error) {
      console.error('❌ Failed to load resources:', error);
      this.resources = [];
    }
  }

  private async loadResourceTemplates(): Promise<void> {
    if (!this.client) return;

    try {
      console.log('Loading resource templates...');

      try {
        const response: ListResourceTemplatesResult = await this.client.listResourceTemplates();
        console.log('Raw resource templates response:', JSON.stringify(response, null, 2));

        if (response && response.resourceTemplates) {
          this.resourceTemplates = response.resourceTemplates;
          console.log(`✅ Successfully loaded ${this.resourceTemplates.length} resource templates:`, this.resourceTemplates.map(t => t.name));
        } else {
          console.warn('⚠️ No resource templates found in response or response.resourceTemplates is undefined');
          this.resourceTemplates = [];
        }
      } catch (error) {
        // Resource templates might not be supported by this server
        if (error instanceof Error && error.message.includes('Method not found')) {
          console.log('ℹ️ Resource templates not supported by this MCP server');
          this.resourceTemplates = [];
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Failed to load resource templates:', error);
      this.resourceTemplates = [];
    }
  }

  resolveResourceTemplateUri(template: MCPResourceTemplate, params: Record<string, any>): string {
    let uri = template.uriTemplate;
    Object.entries(params).forEach(([key, value]) => {
      uri = uri.replace(`{${key}}`, String(value));
    });
    return uri;
  }

  private async loadPrompts(): Promise<void> {
    if (!this.client) return;

    try {
      console.log('Loading prompts...');

      const response: ListPromptsResult = await this.client.listPrompts();
      console.log('Raw prompts response:', JSON.stringify(response, null, 2));

      if (response && response.prompts) {
        this.prompts = response.prompts;
        console.log(`✅ Successfully loaded ${this.prompts.length} prompts:`, this.prompts.map(p => p.name));
      } else {
        console.warn('⚠️ No prompts found in response or response.prompts is undefined');
        this.prompts = [];
      }
    } catch (error) {
      console.error('❌ Failed to load prompts:', error);
      this.prompts = [];
    }
  }

  async callTool(name: string, arguments_: any): Promise<CallToolResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`Calling tool "${name}" with arguments:`, arguments_);
      
      // Use the SDK's callTool method with the correct parameter structure
      const response: CallToolResult = await this.client.callTool({
        name,
        arguments: arguments_
      });
      
      console.log(`Tool "${name}" response:`, response);
      return response;
    } catch (error) {
      console.error(`Tool call error for "${name}":`, error);
      throw error;
    }
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`Reading resource: ${uri}`);
      
      // Use the SDK's readResource method with the correct parameter structure
      const response: ReadResourceResult = await this.client.readResource({ uri });
      
      console.log(`Resource "${uri}" response:`, response);
      return response;
    } catch (error) {
      console.error(`Resource read error for "${uri}":`, error);
      throw error;
    }
  }

  async getPrompt(name: string, arguments_?: any): Promise<GetPromptResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`Getting prompt "${name}" with arguments:`, arguments_);
      
      // Use the SDK's getPrompt method with the correct parameter structure
      const response: GetPromptResult = await this.client.getPrompt({
        name,
        arguments: arguments_ || {}
      });
      
      console.log(`Prompt "${name}" response:`, response);
      return response;
    } catch (error) {
      console.error(`Prompt get error for "${name}":`, error);
      throw error;
    }
  }

  async testMCPRequest(method: string, params: any = {}): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`Testing MCP request: ${method}`, params);
      
      // This is a generic method for testing MCP requests
      // You can customize based on your specific needs
      switch (method) {
        case 'ping':
          return { status: 'ok', timestamp: new Date().toISOString() };
        case 'listTools':
          return await this.client.listTools();
        case 'listResources':
          return await this.client.listResources();
        case 'listPrompts':
          return await this.client.listPrompts();
        default:
          throw new Error(`Unknown test method: ${method}`);
      }
    } catch (error) {
      console.error(`Test MCP request failed for ${method}:`, error);
      throw error;
    }
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  getResources(): MCPResource[] {
    return this.resources;
  }

  getResourceTemplates(): MCPResourceTemplate[] {
    return this.resourceTemplates;
  }

  getPrompts(): MCPPrompt[] {
    return this.prompts;
  }

  getRoots(): MCPRoot[] {
    return this.roots;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Add methods to manage health check setting
  setHealthCheckEnabled(enabled: boolean): void {
    this.enableHealthCheck = enabled;
    console.log('Health check setting updated:', enabled);
  }

  isHealthCheckEnabled(): boolean {
    return this.enableHealthCheck;
  }

  // Add public method to manually reload capabilities for debugging
  async reloadCapabilities(): Promise<void> {
    console.log('Manually reloading capabilities...');
    await this.loadCapabilities();
  }

  async disconnect(): Promise<void> {
    this.connected = false;

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.tools = [];
    this.resources = [];
    this.resourceTemplates = [];
    this.prompts = [];
    this.roots = [];
    
    this.emit('disconnected');
    console.log('MCP client disconnected');
  }
}