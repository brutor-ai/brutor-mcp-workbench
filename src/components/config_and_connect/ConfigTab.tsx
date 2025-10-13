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

import React, { useState } from 'react';
import { Server, Shield, Cpu, TestTube, Play } from 'lucide-react';
import { OAuthTab } from './OAuthTab.tsx';
import { MCPServerTab } from './MCPServerTab.tsx';
import { OpenAITab } from './OpenAITab.tsx';
import { PreConnectionTestsTab } from './PreConnectionTestsTab.tsx';
import { ConnectTab } from './ConnectTab.tsx';
import { OAuthConfig } from '../../types';

interface ConfigTabProps {
    serverBaseUrl: string;
    onServerBaseUrlChange: (url: string) => void;
    mcpEndpointPath: string;
    onMcpEndpointPathChange: (path: string) => void;
    endpointSameAsBase: boolean;
    onEndpointSameAsBaseChange: (same: boolean) => void;
    openaiApiKey: string;
    onOpenaiApiKeyChange: (key: string) => void;
    selectedModel: string;
    onSelectedModelChange: (model: string) => void;
    oauthToken: string;
    onOauthTokenChange: (token: string) => void;
    oauthConfig: OAuthConfig;
    onOauthConfigChange: (config: OAuthConfig) => void;
    connected: boolean;
    loading: boolean;
    capabilities: any;
    onConnect: () => Promise<void>;
    onDisconnect: (performOAuthLogout: boolean) => void;
    tokenManager: any;
    enablePortCheck: boolean;
    onEnablePortCheckChange: (enabled: boolean) => void;
    enableCorsCheck: boolean;
    onEnableCorsCheckChange: (enabled: boolean) => void;
    enableHealthCheck: boolean;
    onEnableHealthCheckChange: (enabled: boolean) => void;
    onLogEntry?: (entry: any) => void;
}

export default function ConfigTab({
                                      serverBaseUrl,
                                      onServerBaseUrlChange,
                                      mcpEndpointPath,
                                      onMcpEndpointPathChange,
                                      endpointSameAsBase,
                                      onEndpointSameAsBaseChange,
                                      openaiApiKey,
                                      onOpenaiApiKeyChange,
                                      selectedModel,
                                      onSelectedModelChange,
                                      oauthToken,
                                      onOauthTokenChange,
                                      oauthConfig,
                                      onOauthConfigChange,
                                      connected,
                                      loading,
                                      capabilities,
                                      onConnect,
                                      onDisconnect,
                                      tokenManager,
                                      enablePortCheck,
                                      onEnablePortCheckChange,
                                      enableCorsCheck,
                                      onEnableCorsCheckChange,
                                      enableHealthCheck,
                                      onEnableHealthCheckChange,
                                      onLogEntry
                                  }: ConfigTabProps) {
    const [activeSubTab, setActiveSubTab] = useState('mcp-server');

    const subTabs = [
        { id: 'mcp-server', label: 'MCP Server', icon: Server },
        { id: 'oauth', label: 'OAuth', icon: Shield },
        { id: 'openai', label: 'OpenAI', icon: Cpu },
        { id: 'tests', label: 'Pre-connect Tests', icon: TestTube },
        { id: 'connect', label: 'Connect', icon: Play }
    ];

    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Sub-tabs Navigation */}
            <div className="flex border-b border-blue-200 bg-sky-100">
                {subTabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveSubTab(id)}
                        className={`tab-button flex items-center space-x-2 px-6 py-2 ${
                            activeSubTab === id ? 'active' : ''
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        {id === 'connect' && (
                            <span className={`text-xs ml-1 ${connected ? 'text-green-600' : 'text-red-600'}`}>
                                {connected ? '●' : '○'}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Sub-tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto">
                    {activeSubTab === 'mcp-server' && (
                        <MCPServerTab
                            serverBaseUrl={serverBaseUrl}
                            onServerBaseUrlChange={onServerBaseUrlChange}
                            mcpEndpointPath={mcpEndpointPath}
                            onMcpEndpointPathChange={onMcpEndpointPathChange}
                            endpointSameAsBase={endpointSameAsBase}
                            onEndpointSameAsBaseChange={onEndpointSameAsBaseChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'oauth' && (
                        <div className="space-y-4">
                            <OAuthTab
                                config={oauthConfig}
                                onConfigChange={onOauthConfigChange}
                                serverUrl={getFullMcpUrl()}
                                disabled={loading || connected}
                                onLogEntry={onLogEntry}
                                tokenManager={tokenManager}
                                hideDiscovery={false}
                            />

                            <div className="card bg-blue-50 border-blue-200">
                                <h4 className="text-xs font-medium text-blue-900 mb-2">💡 Quick Setup Guide</h4>
                                <div className="text-xs text-blue-800 space-y-1">
                                    <div><strong>For PKCE Flow (Recommended for Browser Apps):</strong></div>
                                    <div className="ml-3">
                                        • Configure as public client in your OAuth server
                                    </div>
                                    <div className="ml-3">
                                        • Add redirect URI: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/callback</code>
                                    </div>
                                    <div className="ml-3">
                                        • Enable CORS for: <code className="bg-blue-100 px-1 rounded">{window.location.origin}</code>
                                    </div>
                                    <div className="ml-3 mt-1">
                                        • Use the "Discover" button to auto-configure endpoints
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'openai' && (
                        <OpenAITab
                            openaiApiKey={openaiApiKey}
                            onOpenaiApiKeyChange={onOpenaiApiKeyChange}
                            selectedModel={selectedModel}
                            onSelectedModelChange={onSelectedModelChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'tests' && (
                        <PreConnectionTestsTab
                            enablePortCheck={enablePortCheck}
                            onEnablePortCheckChange={onEnablePortCheckChange}
                            enableCorsCheck={enableCorsCheck}
                            onEnableCorsCheckChange={onEnableCorsCheckChange}
                            enableHealthCheck={enableHealthCheck}
                            onEnableHealthCheckChange={onEnableHealthCheckChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'connect' && (
                        <ConnectTab
                            serverBaseUrl={serverBaseUrl}
                            mcpEndpointPath={mcpEndpointPath}
                            endpointSameAsBase={endpointSameAsBase}
                            oauthConfig={oauthConfig}
                            selectedModel={selectedModel}
                            openaiApiKey={openaiApiKey}
                            enablePortCheck={enablePortCheck}
                            enableCorsCheck={enableCorsCheck}
                            enableHealthCheck={enableHealthCheck}
                            connected={connected}
                            loading={loading}
                            onConnect={onConnect}
                            onDisconnect={onDisconnect}
                            tokenManager={tokenManager}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export { ConfigTab };