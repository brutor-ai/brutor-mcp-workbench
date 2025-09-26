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

import React, { useState, useCallback, useEffect } from 'react';
import { BrutorLogo } from './components/BrutorLogo';
import { ChatTab } from './components/ChatTab';
import { CapabilitiesTab } from './components/CapabilitiesTab';
import { ConfigTab } from './components/ConfigTab';
import { LogsPanel } from './components/LogsPanel';
import { OAuthCallback } from './components/OAuthCallback';
import { useChat } from './hooks/useChat';
import { useMCP } from './hooks/useMCP';
import { MCPResource, MCPPrompt, MCPTool, MCPLog, MCPResourceTemplate } from './types';
import { OAuthConfig } from './types';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const MainApp: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState<'chat' | 'capabilities' | 'config'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'config' || tabParam === 'capabilities') {
      return tabParam as 'chat' | 'capabilities' | 'config';
    }
    return 'chat';
  });
  
  // Add state to prevent duplicate OAuth processing
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  
  const [mcpServerUrl, setMcpServerUrl] = useState(() => 
    localStorage.getItem('mcpServerUrl') || 'http://localhost:3000'
  );
  
  // Add missing MCP endpoint path state
  const [mcpEndpointPath, setMcpEndpointPath] = useState(() => 
    localStorage.getItem('mcpEndpointPath') || '/api/mcp'
  );

  // Add the endpoint same as base checkbox state
  const [endpointSameAsBase, setEndpointSameAsBase] = useState(() => 
    localStorage.getItem('endpointSameAsBase') === 'true'
  );

  // Add health check state with localStorage persistence
  const [enableHealthCheck, setEnableHealthCheck] = useState<boolean>(() => {
    const stored = localStorage.getItem('enableHealthCheck');
    return stored !== null ? JSON.parse(stored) : true; // Default to enabled
  });
  
  const [openaiApiKey, setOpenaiApiKey] = useState(() => 
    localStorage.getItem('openaiApiKey') || ''
  );
  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem('selectedModel') || 'gpt-4o'
  );
  const [oauthToken, setOauthToken] = useState(() => 
    localStorage.getItem('oauthToken') || ''
  );
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig>(() => {
    const stored = localStorage.getItem('oauthConfig');
    return stored ? JSON.parse(stored) : {
      enabled: false,
      flow: 'authorization_code_pkce', // Fixed default to PKCE flow
      clientId: 'mcp-spa-client', // Default for PKCE flow
      clientSecret: '',
      authEndpoint: '',
      tokenEndpoint: '',
      logoutEndpoint: '',
      postLogoutRedirectUri: window.location.origin,
      scope: 'openid profile todo:read todo:write'
    };
  });
  const [logs, setLogs] = useState<MCPLog[]>([]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('mcpServerUrl', mcpServerUrl);
  }, [mcpServerUrl]);

  useEffect(() => {
    localStorage.setItem('mcpEndpointPath', mcpEndpointPath);
  }, [mcpEndpointPath]);

  useEffect(() => {
    localStorage.setItem('endpointSameAsBase', endpointSameAsBase.toString());
  }, [endpointSameAsBase]);

  useEffect(() => {
    localStorage.setItem('enableHealthCheck', JSON.stringify(enableHealthCheck));
  }, [enableHealthCheck]);

  useEffect(() => {
    localStorage.setItem('openaiApiKey', openaiApiKey);
  }, [openaiApiKey]);

  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('oauthToken', oauthToken);
  }, [oauthToken]);

  useEffect(() => {
    localStorage.setItem('oauthConfig', JSON.stringify(oauthConfig));
  }, [oauthConfig]);

  // Hooks
  const {
    mcpClient,
    openaiClient,
    tokenManager,
    connected,
    loading,
    capabilities,
    connect,
    disconnect,
    readResource,
    getPrompt,
    callTool
  } = useMCP();

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isProcessing,
    sendMessage,
    addSystemMessage,
    clearMessages,
    currentAttachments,
    addAttachment,
    removeAttachment
  } = useChat();

  // Add log entry helper
  const addLogEntry = useCallback((entry: Omit<MCPLog, 'id' | 'timestamp'>) => {
    const newLog: MCPLog = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep last 100 logs
  }, []);

  // Handlers
  const handleConnect = useCallback(async () => {
    try {
      addLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'pending',
        operation: 'connect',
        details: { 
          serverUrl: mcpServerUrl,
          mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
          endpointSameAsBase,
          enableHealthCheck,
          oauthEnabled: oauthConfig.enabled,
          oauthFlow: oauthConfig.flow,
          model: selectedModel
        }
      });

      // Pass the health check option to connect function
      await connect(
        mcpServerUrl,
        mcpEndpointPath, 
        openaiApiKey, 
        selectedModel, 
        oauthConfig,
        addLogEntry,
        endpointSameAsBase,
        enableHealthCheck
      );

      addLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'success',
        operation: 'connect',
        details: { 
          serverUrl: mcpServerUrl,
          mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
          endpointSameAsBase,
          enableHealthCheck,
          oauthEnabled: oauthConfig.enabled,
          oauthFlow: oauthConfig.flow,
          model: selectedModel
        },
        response: { 
          tools: capabilities.tools.length,
          resources: capabilities.resources.length,
          resourceTemplates: capabilities.resourceTemplates.length,
          prompts: capabilities.prompts.length,
          healthCheckPerformed: enableHealthCheck
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      
      addLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'error',
        operation: 'connect',
        details: { 
          serverUrl: mcpServerUrl,
          mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
          endpointSameAsBase,
          enableHealthCheck,
          oauthEnabled: oauthConfig.enabled,
          oauthFlow: oauthConfig.flow,
          model: selectedModel
        },
        response: { error: errorMessage }
      });
    }
  }, [connect, mcpServerUrl, mcpEndpointPath, endpointSameAsBase, enableHealthCheck, openaiApiKey, selectedModel, oauthConfig, addLogEntry, capabilities]);

  // Check if we're in an OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    // Handle tab parameter changes
    if (tabParam === 'config' || tabParam === 'capabilities') {
      setActiveTab(tabParam as 'chat' | 'capabilities' | 'config');
    }
    
    // Handle OAuth callback processing - prevent duplicate processing
    // Support both authorization_code and authorization_code_pkce flows
    if (urlParams.has('code') && 
        oauthConfig.enabled && 
        (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') && 
        !isProcessingOAuth) {
      
      console.log('OAuth callback detected, starting processing...');
      console.log('OAuth callback params:', {
        code: urlParams.get('code')?.substring(0, 10) + '...',
        state: urlParams.get('state'),
        hasError: urlParams.has('error'),
        flow: oauthConfig.flow
      });
      
      setIsProcessingOAuth(true);
      setActiveTab('config');
      
      if (!connected && !loading) {
        console.log('Triggering connection for OAuth callback...');
        handleConnect().then(() => {
          console.log('Connection completed after OAuth callback');
          // Force re-evaluation of authentication state
          setTimeout(() => {
            console.log('Checking post-connection auth state:', {
              hasTokenManager: !!tokenManager,
              isValid: tokenManager?.isTokenValid(),
              tokenInfo: tokenManager?.getTokenInfo()
            });
          }, 1000);
        }).catch((error) => {
          console.error('Connection failed after OAuth callback:', error);
        }).finally(() => {
          // Clean up URL and reset processing state after completion
          setTimeout(() => {
            setIsProcessingOAuth(false);
            window.history.replaceState({}, '', window.location.pathname + '?tab=config');
          }, 2000);
        });
      } else {
        // Reset processing state if we're already connected
        setTimeout(() => {
          setIsProcessingOAuth(false);
        }, 1000);
      }
    }
  }, [oauthConfig.enabled, oauthConfig.flow, connected, loading, isProcessingOAuth]);
  
  const handleDisconnect = useCallback((performOAuthLogout = false) => {
    disconnect(performOAuthLogout);
    clearMessages();
    
    addLogEntry({
      source: 'MCP',
      type: 'connection',
      status: 'success',
      operation: performOAuthLogout ? 'oauth-logout' : 'disconnect',
      details: { 
        oauthLogout: performOAuthLogout,
        flow: oauthConfig.flow 
      },
      response: { success: true }
    });
  }, [disconnect, clearMessages, addLogEntry, oauthConfig.flow]);

  const handleSendMessage = useCallback(async () => {
    if (!mcpClient || !openaiClient) return;

    try {
      await sendMessage(mcpClient, openaiClient, capabilities.tools, (toolName, args, result) => {
        addLogEntry({
          source: 'MCP',
          type: 'tool_call',
          status: result.error ? 'error' : 'success',
          operation: toolName,
          details: args,
          response: result
        });
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  }, [sendMessage, mcpClient, openaiClient, capabilities.tools, addLogEntry]);

  const handleResourceRead = useCallback(async (resource: MCPResource) => {
    try {
      addLogEntry({
        source: 'MCP',
        type: 'resource_read',
        status: 'pending',
        operation: resource.name,
        details: { uri: resource.uri }
      });

      const result = await readResource(resource.uri);

      if (result.content) {
        addLogEntry({
          source: 'MCP',
          type: 'resource_read',
          status: 'success',
          operation: resource.name,
          details: { uri: resource.uri },
          response: { 
            size: `${(result.content.length / 1024).toFixed(1)}kb`,
            contentType: resource.mimeType
          }
        });

        addSystemMessage(`Resource "${resource.name}" loaded: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
        setCurrentMessage(prev =>
          prev + (prev ? '\n\n' : '') + `Help me understand this resource: "${resource.name}"`
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read resource';
      
      addLogEntry({
        source: 'MCP',
        type: 'resource_read',
        status: 'error',
        operation: resource.name,
        details: { uri: resource.uri },
        response: { error: errorMessage }
      });
    }
  }, [readResource, addSystemMessage, setCurrentMessage, addLogEntry]);

  const handleResourceTemplateUse = useCallback(async (template: MCPResourceTemplate, params?: any) => {
    try {
      addLogEntry({
        source: 'MCP',
        type: 'resource_read',
        status: 'pending',
        operation: template.name,
        details: { template: template.uriTemplate, params }
      });

      // Generate the actual URI from template and parameters
      let uri = template.uriTemplate;
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          uri = uri.replace(`{${key}}`, String(value));
        });
      }

      const result = await readResource(uri);

      if (result.content) {
        addLogEntry({
          source: 'MCP',
          type: 'resource_read',
          status: 'success',
          operation: template.name,
          details: { template: template.uriTemplate, params, resolvedUri: uri },
          response: { 
            size: `${(result.content.length / 1024).toFixed(1)}kb`,
            contentType: 'unknown'
          }
        });

        addSystemMessage(`Resource template "${template.name}" loaded from ${uri}: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
        setCurrentMessage(prev =>
          prev + (prev ? '\n\n' : '') + `Help me understand this resource from template: "${template.name}"`
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read resource template';
      
      addLogEntry({
        source: 'MCP',
        type: 'resource_read',
        status: 'error',
        operation: template.name,
        details: { template: template.uriTemplate, params },
        response: { error: errorMessage }
      });
    }
  }, [readResource, addSystemMessage, setCurrentMessage, addLogEntry]);

  const handlePromptUse = useCallback(async (prompt: MCPPrompt) => {
    try {
      addLogEntry({
        source: 'MCP',
        type: 'prompt_get',
        status: 'pending',
        operation: prompt.name,
        details: { arguments: {} }
      });

      const result = await getPrompt(prompt.name, {});

      if (result.messages && result.messages.length > 0) {
        const content = result.messages
          .map((msg: any) => {
            if (msg.content && msg.content.text) return msg.content.text;
            if (typeof msg.content === 'string') return msg.content;
            return JSON.stringify(msg.content || msg, null, 2);
          })
          .join('\n\n');

        addLogEntry({
          source: 'MCP',
          type: 'prompt_get',
          status: 'success',
          operation: prompt.name,
          details: { arguments: {} },
          response: { 
            messages: result.messages.length,
            tokens: content.length
          }
        });

        setCurrentMessage(content);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to use prompt';
      
      addLogEntry({
        source: 'MCP',
        type: 'prompt_get',
        status: 'error',
        operation: prompt.name,
        details: { arguments: {} },
        response: { error: errorMessage }
      });
    }
  }, [getPrompt, setCurrentMessage, addLogEntry]);

  const handleToolCall = useCallback(async (tool: MCPTool, args: any) => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }

    try {
      addLogEntry({
        source: 'MCP',
        type: 'tool_call',
        status: 'pending',
        operation: tool.name,
        details: args
      });

      const result = await callTool(tool.name, args);

      addLogEntry({
        source: 'MCP',
        type: 'tool_call',
        status: 'success',
        operation: tool.name,
        details: args,
        response: {
          contentLength: result.content?.length || 0,
          isError: result.isError || false
        }
      });

      // Show result in a modal or notification
      const content = result.content
        ?.map((c: any) => {
          if (c.type === 'text') return c.text;
          if (c.text) return c.text;
          if (c.blob) return `[Binary content: ${c.blob.substring(0, 100)}...]`;
          return JSON.stringify(c, null, 2);
        })
        .join('\n') || JSON.stringify(result, null, 2);

      // You can show this in a modal or add to chat
      addSystemMessage(`Tool "${tool.name}" result:\n${content}`);
      
      return result;
    } catch (err) {
      throw err;
    }
  }, [mcpClient, callTool, addLogEntry]);

  const handleToolCallForCapabilities = useCallback(async (tool: MCPTool, args: any) => {
    if (!mcpClient) {
      throw new Error('MCP client not connected');
    }

    try {
      addLogEntry({
        source: 'MCP',
        type: 'tool_call',
        status: 'pending',
        operation: tool.name,
        details: args
      });

      const result = await callTool(tool.name, args);

      const formatToolResult = (result: any): string => {
        // If there's structured content, use that
        if (result.structuredContent) {
          return JSON.stringify(result.structuredContent, null, 2);
        }
        
        // If it's a structured result with an array, format it with numbering
        if (result.result && Array.isArray(result.result)) {
          const items = result.result.map((item: any, index: number) => {
            return `${index + 1}. ${JSON.stringify(item, null, 2)}`;
          }).join('\n\n');
          
          return `Found ${result.result.length} items:\n\n${items}`;
        }
        
        // Otherwise format the full result with nice indentation
        return JSON.stringify(result, null, 2);
      };

      const resultContent = formatToolResult(result);

      addLogEntry({
        source: 'MCP',
        type: 'tool_call',
        status: 'success',
        operation: tool.name,
        details: args,
        response: {
          contentLength: result.content?.length || 0,
          isError: result.isError || false,
          result: resultContent
        }
      });
      
      return {
        ...result,
        result: resultContent
      };
    } catch (err) {
      addLogEntry({
        source: 'MCP',
        type: 'tool_call',
        status: 'error',
        operation: tool.name,
        details: args,
        response: { error: err instanceof Error ? err.message : 'Unknown error' }
      });
      throw err;
    }
  }, [mcpClient, callTool, addLogEntry]);

  // Get user permissions for display
  const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };
  const isAuthenticated = tokenManager?.isTokenValid() || false;
  const userInfo = tokenManager?.getUserInfo();
  
  // Enhanced debug logging
  useEffect(() => {
    console.log('Auth Debug State:', {
      oauthEnabled: oauthConfig.enabled,
      oauthFlow: oauthConfig.flow,
      connected: connected,
      hasTokenManager: !!tokenManager,
      isAuthenticated: isAuthenticated,
      tokenManagerValid: tokenManager?.isTokenValid(),
      userPermissions: userPermissions,
      tokenInfo: tokenManager?.getTokenInfo(),
      userInfo: tokenManager?.getUserInfo(),
      accessToken: tokenManager?.getAccessToken() ? 'present' : 'missing'
    });
  }, [oauthConfig.enabled, oauthConfig.flow, connected, tokenManager, isAuthenticated, userPermissions, loading]);

  return (
    <div className="h-screen flex">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Tab Headers */}
        <div className="flex border-b tab-header">
          {/* Logo and Title */}
          <div className="flex items-center px-4 py-2 border-r border-white border-opacity-30">
            <BrutorLogo size="medium" showText={true} className="text-white" />
          </div>
          
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`tab-button ${activeTab === 'capabilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('capabilities')}
          >
            Capabilities
            {connected && (
              <span className="text-small ml-1 text-muted">
                ({capabilities.tools.length + capabilities.resources.length + capabilities.resourceTemplates.length + capabilities.prompts.length})
              </span>
            )}
          </button>
          <button
            className={`tab-button ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Config
            <span className={`text-small ml-1 ${connected ? 'status-connected' : 'status-disconnected'}`}>
              {connected ? '●' : '○'}
            </span>
          </button>
          
          {/* Spacer */}
          <div className="flex-1"></div>
          
          {/* User Info - shows in middle */}
          {oauthConfig.enabled && (
            <div className="flex items-center px-3 py-1 bg-blue-50 rounded-md border border-blue-200">
              <div className="text-small">
                {isAuthenticated && userInfo ? (
                  <span className="font-medium text-blue-900">
                    {userInfo.preferred_username || userInfo.login || userInfo.email || 'User'} - 
                    {userPermissions.canWrite ? ' Writer' : 
                     userPermissions.canRead ? ' Viewer' : ' No Access'}
                  </span>
                ) : connected && tokenManager ? (
                  <span className="text-blue-700">
                    Connected {tokenManager.getAccessToken() ? '(Has Token)' : '(No Token)'}
                  </span>
                ) : (
                  <span className="text-blue-700">Not Authenticated</span>
                )}
              </div>
            </div>
          )}
          
          {/* Spacer */}
          <div className="flex-1"></div>
          
          {/* Connection Info */}
          <div className="flex items-center pr-4">
            <div className="text-small text-blue-900 font-medium">
              {connected ? (
                <>
                  MCP = {endpointSameAsBase ? mcpServerUrl : `${mcpServerUrl}${mcpEndpointPath}`} | LLM = {selectedModel.toUpperCase()}
                  {enableHealthCheck ? ' | Health ✓' : ' | Health ✗'}
                  {oauthConfig.enabled && oauthConfig.flow === 'authorization_code' && isAuthenticated && (
                    <span className="ml-2">
                      | User: {userPermissions.canWrite ? 'Write' : userPermissions.canRead ? 'Read' : 'No'} Access
                    </span>
                  )}
                </>
              ) : (
                'Disconnected'
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <ChatTab
              messages={messages}
              currentMessage={currentMessage}
              onMessageChange={setCurrentMessage}
              onSendMessage={handleSendMessage}
              connected={connected}
              isProcessing={isProcessing}
              capabilities={capabilities}
              onResourceRead={handleResourceRead}
              onPromptUse={handlePromptUse}
              onResourceTemplateUse={handleResourceTemplateUse}
              currentAttachments={currentAttachments}
              onAddAttachment={addAttachment}
              onRemoveAttachment={removeAttachment}
            />
          ) : activeTab === 'capabilities' ? (
            <CapabilitiesTab
              connected={connected}
              capabilities={capabilities}
              onResourceRead={handleResourceRead}
              onPromptUse={handlePromptUse}
              onToolCall={handleToolCallForCapabilities}
              onResourceTemplateUse={handleResourceTemplateUse}
              readResource={readResource}
              mcpClient={mcpClient}     
              getPrompt={getPrompt}     
            />
          ) : (
            <ConfigTab
              serverBaseUrl={mcpServerUrl}
              onServerBaseUrlChange={setMcpServerUrl}
              mcpEndpointPath={mcpEndpointPath}
              onMcpEndpointPathChange={setMcpEndpointPath}
              endpointSameAsBase={endpointSameAsBase}
              onEndpointSameAsBaseChange={setEndpointSameAsBase}
              openaiApiKey={openaiApiKey}
              onOpenaiApiKeyChange={setOpenaiApiKey}
              selectedModel={selectedModel}
              onSelectedModelChange={setSelectedModel}
              oauthToken={oauthToken}
              onOauthTokenChange={setOauthToken}
              oauthConfig={oauthConfig}
              onOauthConfigChange={setOauthConfig}
              connected={connected}
              loading={loading}
              capabilities={capabilities}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onResourceRead={handleResourceRead}
              onPromptUse={handlePromptUse}
              onLogEntry={addLogEntry}
              tokenManager={tokenManager}
              enableHealthCheck={enableHealthCheck}
              onEnableHealthCheckChange={setEnableHealthCheck}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Logs */}
      <div className="w-96 border-l">
        <LogsPanel
          logs={logs}
          onClearLogs={() => setLogs([])}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/callback" element={<OAuthCallback />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
};

export default App;