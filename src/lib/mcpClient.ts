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

export interface PreConnectionTestResults {
    portTest?: {
        status: 'success' | 'error' | 'skipped';
        message: string;
        duration?: number;
    };
    corsTest?: {
        status: 'success' | 'error' | 'skipped';
        message: string;
        duration?: number;
    };
    healthTest?: {
        status: 'success' | 'error' | 'skipped';
        message: string;
        duration?: number;
    };
}

export class MCPClient {
    private serverBaseUrl: string;
    private mcpEndpointPath: string;
    private bearerToken: string | null = null;
    private enablePortCheck: boolean = true;
    private enableCorsCheck: boolean = true;
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
        enablePortCheck: boolean = true,
        enableCorsCheck: boolean = true,
        enableHealthCheck: boolean = true
    ) {
        this.serverBaseUrl = serverBaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
        this.mcpEndpointPath = mcpEndpointPath.startsWith('/') ? mcpEndpointPath : `/${mcpEndpointPath}`;
        this.bearerToken = bearerToken || null;
        this.enablePortCheck = enablePortCheck;
        this.enableCorsCheck = enableCorsCheck;
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
                enablePortCheck: this.enablePortCheck,
                enableCorsCheck: this.enableCorsCheck,
                enableHealthCheck: this.enableHealthCheck,
                clientOrigin: window.location.origin
            });

            // Run pre-connection tests and collect results
            const testResults = await this.runPreConnectionTests();

            // Emit test results for display
            this.emit('preConnectionTests', testResults);

            // Check if any critical tests failed
            const criticalFailure =
                (testResults.portTest?.status === 'error') ||
                (testResults.corsTest?.status === 'error') ||
                (testResults.healthTest?.status === 'error');

            if (criticalFailure) {
                // Determine which error to throw based on test results
                if (testResults.portTest?.status === 'error') {
                    throw this.createConnectionRefusedError(new Error(testResults.portTest.message));
                } else if (testResults.corsTest?.status === 'error') {
                    throw this.createCorsError(new Error(testResults.corsTest.message));
                } else if (testResults.healthTest?.status === 'error') {
                    throw new Error(testResults.healthTest.message);
                }
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
            try {
                await this.client.connect(this.transport);
                console.log('MCP client connected successfully');
            } catch (error) {
                console.error('Failed to connect MCP client to transport:', error);
                // Enhance error before throwing
                throw this.enhanceConnectionError(error);
            }

            this.connected = true;

            // Load available capabilities after successful connection
            console.log('Loading MCP capabilities...');
            await this.loadCapabilities();
            console.log('MCP capabilities loaded successfully');

            this.emit('connected', {
                message: 'Connected using StreamableHTTP transport',
                transportType: 'StreamableHTTP',
                serverBaseUrl: this.serverBaseUrl,
                mcpEndpointPath: this.mcpEndpointPath,
                fullMcpUrl: `${this.serverBaseUrl}${this.mcpEndpointPath}`,
                testResults,
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
            throw error;
        }
    }

    private async runPreConnectionTests(): Promise<PreConnectionTestResults> {
        const results: PreConnectionTestResults = {};

        // Test 1: Port connectivity
        if (this.enablePortCheck) {
            results.portTest = await this.testPort();
        } else {
            results.portTest = {
                status: 'skipped',
                message: 'Port test disabled'
            };
        }

        // Test 2: CORS configuration
        if (this.enableCorsCheck) {
            results.corsTest = await this.testCORS();
        } else {
            results.corsTest = {
                status: 'skipped',
                message: 'CORS test disabled'
            };
        }

        // Test 3: Health endpoint
        if (this.enableHealthCheck) {
            results.healthTest = await this.testHealth();
        } else {
            results.healthTest = {
                status: 'skipped',
                message: 'Health test disabled'
            };
        }

        return results;
    }

    private async testPort(): Promise<{ status: 'success' | 'error'; message: string; duration: number }> {
        const startTime = Date.now();
        console.log('Testing port connectivity at:', this.serverBaseUrl);

        try {
            // Use a simple no-cors fetch with timeout to test if server is reachable
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            await fetch(this.serverBaseUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            return {
                status: 'success',
                message: `Server is reachable at ${this.serverBaseUrl}`,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    status: 'error',
                    message: `Connection timeout - server not reachable at ${this.serverBaseUrl}`,
                    duration
                };
            }

            return {
                status: 'error',
                message: `Cannot reach server at ${this.serverBaseUrl} - server may be down or port blocked`,
                duration
            };
        }
    }

    private async testCORS(): Promise<{ status: 'success' | 'error'; message: string; duration: number }> {
        const startTime = Date.now();
        const testUrl = `${this.serverBaseUrl}${this.mcpEndpointPath}`;
        console.log('Testing CORS at:', testUrl);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(testUrl, {
                method: 'HEAD',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    ...(this.bearerToken && { 'Authorization': `Bearer ${this.bearerToken}` })
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            return {
                status: 'success',
                message: `CORS is properly configured - server allows requests from ${window.location.origin}`,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    status: 'error',
                    message: 'CORS test timeout',
                    duration
                };
            }

            if (error instanceof TypeError) {
                return {
                    status: 'error',
                    message: `CORS not configured - server must allow requests from ${window.location.origin}`,
                    duration
                };
            }

            return {
                status: 'error',
                message: `CORS test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                duration
            };
        }
    }

    private async testHealth(): Promise<{ status: 'success' | 'error'; message: string; duration: number }> {
        const startTime = Date.now();
        const healthUrl = `${this.serverBaseUrl}/health`;
        console.log('Testing health endpoint at:', healthUrl);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(healthUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    ...(this.bearerToken && { 'Authorization': `Bearer ${this.bearerToken}` })
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            if (response.ok) {
                return {
                    status: 'success',
                    message: `Health endpoint responded with status ${response.status}`,
                    duration
                };
            } else {
                return {
                    status: 'error',
                    message: `Health endpoint returned error: ${response.status} ${response.statusText}`,
                    duration
                };
            }
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    status: 'error',
                    message: 'Health endpoint timeout',
                    duration
                };
            }

            return {
                status: 'error',
                message: `Health endpoint not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
                duration
            };
        }
    }

    private createConnectionRefusedError(originalError: any): Error {
        const connectionError = new Error(
            `CONNECTION_REFUSED: Unable to connect to the MCP server at ${this.serverBaseUrl}. ` +
            `The server appears to be unavailable or not running. Please check: ` +
            `1) The server is started and running, ` +
            `2) The server URL and port are correct, ` +
            `3) No firewall is blocking the connection. ` +
            `Original error: ${originalError.message || 'Unknown error'}`
        );
        (connectionError as any).isConnectionRefused = true;
        (connectionError as any).originalError = originalError;
        (connectionError as any).clientOrigin = window.location.origin;
        (connectionError as any).serverUrl = this.serverBaseUrl;
        return connectionError;
    }

    private createCorsError(originalError: any): Error {
        const corsError = new Error(
            `CORS_ERROR: The MCP server must be configured to allow requests from ${window.location.origin}. ` +
            `Please ensure the server sends proper CORS headers (Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers) ` +
            `and does not redirect preflight requests. Original error: ${originalError.message || 'Unknown error'}`
        );
        (corsError as any).isCorsError = true;
        (corsError as any).originalError = originalError;
        (corsError as any).clientOrigin = window.location.origin;
        (corsError as any).serverUrl = this.serverBaseUrl;
        return corsError;
    }

    private enhanceConnectionError(error: any): Error {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorName = error?.name || '';
        const errorString = String(error).toLowerCase();

        // Log the raw error for debugging
        console.log('Enhancing connection error:', {
            message: errorMessage,
            name: errorName,
            error: error
        });

        // Detect explicit CORS-related errors
        const hasCorsIndicators = (
            errorMessage.includes('cors') ||
            errorMessage.includes('cross-origin') ||
            errorMessage.includes('preflight') ||
            errorMessage.includes('access control') ||
            errorString.includes('cors') ||
            errorString.includes('cross-origin') ||
            errorString.includes('preflight')
        );

        // Connection refused indicators
        const hasConnectionRefusedIndicators = (
            errorMessage.includes('err_connection_refused') ||
            errorMessage.includes('connection refused') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('timeout') ||
            errorString.includes('err_connection_refused')
        );

        // If we have explicit connection refused indicators
        if (hasConnectionRefusedIndicators) {
            return this.createConnectionRefusedError(error);
        }

        // If we have explicit CORS indicators
        if (hasCorsIndicators) {
            return this.createCorsError(error);
        }

        // For generic "Failed to fetch" errors, default to CORS error
        if (errorName === 'TypeError' && errorMessage.includes('failed to fetch')) {
            return this.createCorsError(error);
        }

        // Return original error if not a recognized type
        return error instanceof Error ? error : new Error(String(error));
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

    // Add methods to manage test settings
    setPortCheckEnabled(enabled: boolean): void {
        this.enablePortCheck = enabled;
        console.log('Port check setting updated:', enabled);
    }

    isPortCheckEnabled(): boolean {
        return this.enablePortCheck;
    }

    setCorsCheckEnabled(enabled: boolean): void {
        this.enableCorsCheck = enabled;
        console.log('CORS check setting updated:', enabled);
    }

    isCorsCheckEnabled(): boolean {
        return this.enableCorsCheck;
    }

    setHealthCheckEnabled(enabled: boolean): void {
        this.enableHealthCheck = enabled;
        console.log('Health check setting updated:', enabled);
    }

    isHealthCheckEnabled(): boolean {
        return this.enableHealthCheck;
    }

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