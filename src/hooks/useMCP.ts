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

import { useState, useCallback, useEffect } from 'react';
import { MCPClient } from '../lib/mcpClient';
import { OpenAIClient } from '../lib/openaiClient';
import { OAuthTokenManager } from '../lib/oauthTokenManager';
import { MCPCapabilities, MCPLog } from '../types';

export const useMCP = () => {
  const [mcpClient, setMcpClient] = useState<MCPClient | null>(null);
  const [openaiClient, setOpenaiClient] = useState<OpenAIClient | null>(null);
  const [tokenManager, setTokenManager] = useState<OAuthTokenManager | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<MCPCapabilities>({
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    roots: []
  });

  const connect = useCallback(async (
    serverBaseUrl: string,
    mcpEndpointPath: string,
    apiKey: string,
    model: string = 'gpt-4o',
    oauthConfig?: any,
    logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void,
    endpointSameAsBase: boolean = false,
    enablePortCheck: boolean = true,
    enableCorsCheck: boolean = true,
    enableHealthCheck: boolean = true,
    openaiProxyUrl?: string
  ) => {
    // Only require API key if not using proxy
    if (!serverBaseUrl) {
      throw new Error('Please provide MCP Server URL');
    }

    if (!openaiProxyUrl && !apiKey) {
      throw new Error('Please provide OpenAI API Key or configure a Proxy Server URL');
    }

    setLoading(true);
    setConnected(false);


    // Reset capabilities
    setCapabilities({
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: [],
      roots: []
    });

    try {
      let authToken: string | undefined;
      let tokenMgr: OAuthTokenManager | null = null;

      // Handle OAuth token acquisition if OAuth is enabled
      if (oauthConfig?.enabled) {
        console.log('OAuth enabled, flow:', oauthConfig.flow);

        // Create token manager
        tokenMgr = new OAuthTokenManager(oauthConfig, logCallback);
        setTokenManager(tokenMgr);

        try {
          // Get access token - this will handle all three flows
          authToken = await tokenMgr.getValidToken();
          console.log('OAuth token acquired, length:', authToken.length);

          // Verify token manager state after token acquisition
          console.log('Token manager state after acquisition:', {
            isValid: tokenMgr.isTokenValid(),
            tokenInfo: tokenMgr.getTokenInfo(),
            userPermissions: tokenMgr.getUserPermissions(),
            userInfo: tokenMgr.getUserInfo()
          });

          if (logCallback) {
            const tokenInfo = tokenMgr.getTokenInfo();
            logCallback({
              source: 'MCP',
              type: 'connection',
              status: 'success',
              operation: 'oauth-token-ready',
              details: {
                flow: oauthConfig.flow,
                tokenLength: authToken.length,
                hasToken: true,
                permissions: tokenInfo.permissions
              },
              response: {
                authenticated: true,
                userInfo: tokenInfo.userInfo,
                roles: tokenInfo.roles
              }
            });
          }
        } catch (error) {
          // Handle OAuth errors
          console.error('OAuth authentication failed:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Check if this is a scope configuration error
          if (errorMessage.includes('OAuth scope configuration error') ||
            errorMessage.includes('invalid_scope')) {
            console.log('🔴 Scope configuration error detected - user will be shown scope error alert');

            // Don't throw - just stop the connection process
            // The scope error has already been logged and URL redirected
            setLoading(false);
            return false; // Indicate connection didn't complete
          }

          // Check if this is the "redirecting to login" message
          if (error instanceof Error && error.message.includes('Authorization flow started')) {
            // This is expected for authorization code flows - user is being redirected
            console.log('User is being redirected to authorization server');
            setLoading(false);
            return false; // Don't throw, just indicate we're not connected yet
          }

          // For other OAuth errors, propagate them
          if (logCallback) {
            logCallback({
              source: 'MCP',
              type: 'connection',
              status: 'error',
              operation: 'oauth-authentication',
              details: {
                flow: oauthConfig.flow,
                errorType: (error as any).errorType || 'unknown'
              },
              response: {
                error: errorMessage
              }
            });
          }

          throw new Error(`OAuth authentication failed: ${errorMessage}`);
        }
      } else {
        console.log('OAuth disabled, connecting without authentication');
      }

      // Determine the actual MCP URL based on configuration
      let actualMcpUrl: string;
      let actualServerBaseUrl: string;
      let actualMcpEndpointPath: string;

      if (endpointSameAsBase) {
        // When endpoint is same as base, use the full URL as provided
        actualMcpUrl = serverBaseUrl;

        // For MCPClient constructor, we need to split this properly
        try {
          const url = new URL(serverBaseUrl);
          actualServerBaseUrl = `${url.protocol}//${url.host}`;
          actualMcpEndpointPath = url.pathname || '/';
        } catch (error) {
          throw new Error('Invalid server URL format');
        }
      } else {
        // Traditional split: base URL + endpoint path
        actualServerBaseUrl = serverBaseUrl;
        actualMcpEndpointPath = mcpEndpointPath || '/api/mcp';
        actualMcpUrl = `${actualServerBaseUrl.replace(/\/+$/, '')}${actualMcpEndpointPath}`;
      }

      console.log('Creating MCP client with:', {
        actualServerBaseUrl,
        actualMcpEndpointPath,
        actualMcpUrl,
        hasAuthToken: !!authToken,
        endpointSameAsBase,
        enablePortCheck,
        enableCorsCheck,
        enableHealthCheck
      });

      // Create clients with correct parameters, including all three test options
      const client = new MCPClient(
        actualServerBaseUrl,
        actualMcpEndpointPath,
        authToken,
        enablePortCheck,
        enableCorsCheck,
        enableHealthCheck
      );

      // UPDATED: Create OpenAI client with proxy URL
      const openai = new OpenAIClient(
        apiKey,
        model,
        logCallback,
        openaiProxyUrl // ADD THIS - passes proxy URL as baseUrl
      );

      // Log proxy usage
      if (logCallback) {
        logCallback({
          source: 'LLM',
          type: 'connection',
          status: 'success',
          operation: 'openai-client-init',
          details: {
            model,
            usingProxy: !!openaiProxyUrl,
            proxyUrl: openaiProxyUrl || 'direct to api.openai.com'
          },
          response: {
            initialized: true
          }
        });
      }

      // Set up event listeners before connecting
      client.addEventListener('connected', (data) => {
        console.log('MCP client connected:', data);
        setConnected(true);
        setLoading(false);
      });

      client.addEventListener('capabilitiesLoaded', (caps: MCPCapabilities) => {
        console.log('Capabilities loaded in hook:', caps);
        setCapabilities(caps);
      });

      // Listen for pre-connection test results
      client.addEventListener('preConnectionTests', (testResults) => {
        console.log('Pre-connection test results:', testResults);
        if (logCallback) {
          logCallback({
            source: 'MCP',
            type: 'connection',
            status: 'success',
            operation: 'pre-connection-tests',
            details: {
              portTest: testResults.portTest,
              corsTest: testResults.corsTest,
              healthTest: testResults.healthTest
            },
            response: testResults
          });
        }
      });

      client.addEventListener('error', (error) => {
        console.error('MCP client error:', error);
        setLoading(false);
        setConnected(false);
        setCapabilities({
          tools: [],
          resources: [],
          resourceTemplates: [],
          prompts: [],
          roots: []
        });
        throw error;
      });
      client.addEventListener('disconnected', () => {
        console.log('MCP client disconnected');
        setConnected(false);
        setCapabilities({
          tools: [],
          resources: [],
          resourceTemplates: [],
          prompts: [],
          roots: []
        });
      });

      // Attempt connection
      console.log('Attempting to connect to MCP server...');
      const success = await client.connect();

      if (success) {
        setMcpClient(client);
        setOpenaiClient(openai);
        // Ensure token manager state is preserved
        if (tokenMgr && !tokenManager) {
          setTokenManager(tokenMgr);
        }
        console.log('Connection successful, clients and token manager set');
        return true;
      } else {
        setLoading(false);
        throw new Error('Failed to connect to MCP server');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setLoading(false);
      setConnected(false);

      // Only clear token manager if OAuth actually failed, not if MCP connection failed
      if (error instanceof Error && error.message.includes('OAuth authentication failed')) {
        setTokenManager(null);
      }

      setCapabilities({
        tools: [],
        resources: [],
        resourceTemplates: [],
        prompts: [],
        roots: []
      });
      throw error;
    }
  }, [tokenManager]);

  const disconnect = useCallback((performOAuthLogout = false) => {
    if (mcpClient) {
      mcpClient.disconnect();
      setMcpClient(null);
      setOpenaiClient(null);
      setConnected(false);
      setCapabilities({
        tools: [],
        resources: [],
        resourceTemplates: [],
        prompts: [],
        roots: []
      });
    }

    // Clear OAuth token with optional IdP logout
    if (tokenManager) {
      tokenManager.logout(performOAuthLogout);
      setTokenManager(null);
    }
  }, [mcpClient, tokenManager]);

  const refreshToken = useCallback(async () => {
    if (!tokenManager) {
      throw new Error('No token manager available');
    }

    console.log('Refreshing OAuth token...');
    const newToken = await tokenManager.getValidToken();

    // Update MCP client with new token if needed
    if (mcpClient) {
      console.log('New token acquired for refresh');
    }

    return newToken;
  }, [tokenManager, mcpClient]);

  const getTokenInfo = useCallback(() => {
    if (!tokenManager) {
      return { hasToken: false };
    }
    return tokenManager.getTokenInfo();
  }, [tokenManager]);

  const readResource = useCallback(async (uri: string): Promise<{ content?: string }> => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }

    console.log(`Reading resource: ${uri}`);
    const startTime = Date.now();

    try {
      const result = await mcpClient.readResource(uri);
      const duration = Date.now() - startTime;
      console.log(`Resource read completed in ${duration}ms`);

      // Extract text content for viewing
      let textContent = '';
      if (result.contents && result.contents.length > 0) {
        textContent = result.contents
          .map((c: any) => {
            if (c.text) return c.text;
            if (c.blob && typeof c.blob === 'string') return c.blob;
            return JSON.stringify(c, null, 2);
          })
          .join('\n');
      }

      return { content: textContent };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Resource read failed after ${duration}ms:`, error);
      throw error;
    }
  }, [mcpClient]);

  const getPrompt = useCallback(async (name: string, args?: any) => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }

    console.log(`Getting prompt: ${name}`, args);
    const startTime = Date.now();

    try {
      const result = await mcpClient.getPrompt(name, args);
      const duration = Date.now() - startTime;
      console.log(`Prompt retrieval completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Prompt retrieval failed after ${duration}ms:`, error);
      throw error;
    }
  }, [mcpClient]);

  const callTool = useCallback(async (name: string, args: any) => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }

    console.log(`Calling tool: ${name}`, args);
    const startTime = Date.now();

    try {
      const result = await mcpClient.callTool(name, args);
      const duration = Date.now() - startTime;
      console.log(`Tool call completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Tool call failed after ${duration}ms:`, error);
      throw error;
    }
  }, [mcpClient]);

  // Auto-reconnect on network recovery
  useEffect(() => {
    const handleOnline = () => {
      if (!connected && mcpClient) {
        console.log('Network recovered, attempting to reconnect...');
        // Could implement auto-reconnect logic here
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connected, mcpClient]);

  // Handle OAuth callback on component mount
  useEffect(() => {
    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') || urlParams.has('error')) {
      console.log('Detected OAuth callback on mount');
      // The token manager will handle this when connect() is called
    }
  }, []);

  // Cleanup on unmount ONLY - not on dependency changes
  useEffect(() => {
    // This cleanup only runs when the component unmounts
    return () => {
      console.log('useMCP cleanup on unmount');
      if (mcpClient) {
        console.log('Disconnecting MCP client on unmount');
        mcpClient.disconnect();
      }
      if (tokenManager) {
        console.log('Clearing token on unmount');
        tokenManager.clearToken();
      }
    };
  }, []); // CRITICAL: Empty dependency array so cleanup only runs on unmount

  const reloadCapabilities = useCallback(async () => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }
    console.log('Reloading capabilities...');
    await mcpClient.reloadCapabilities();
  }, [mcpClient]);

  const testMCPRequest = useCallback(async (method: string, params: any = {}) => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }
    console.log(`Testing MCP request: ${method}`, params);
    return await mcpClient.testMCPRequest(method, params);
  }, [mcpClient]);

  return {
    mcpClient,
    openaiClient,
    tokenManager,
    connected,
    loading,
    capabilities,
    connect,
    disconnect,
    refreshToken,
    getTokenInfo,
    readResource,
    getPrompt,
    callTool,
    reloadCapabilities,
    testMCPRequest
  };
};