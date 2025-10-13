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
import { CheckCircle, AlertCircle } from 'lucide-react';

interface MCPServerTabProps {
    serverBaseUrl: string;
    onServerBaseUrlChange: (url: string) => void;
    mcpEndpointPath: string;
    onMcpEndpointPathChange: (path: string) => void;
    endpointSameAsBase: boolean;
    onEndpointSameAsBaseChange: (same: boolean) => void;
    disabled: boolean;
}

export const MCPServerTab: React.FC<MCPServerTabProps> = ({
                                                              serverBaseUrl,
                                                              onServerBaseUrlChange,
                                                              mcpEndpointPath,
                                                              onMcpEndpointPathChange,
                                                              endpointSameAsBase,
                                                              onEndpointSameAsBaseChange,
                                                              disabled
                                                          }) => {
    const [testResult, setTestResult] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);

    const isValidUrl = (url: string) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const isValidPath = (path: string) => {
        if (endpointSameAsBase) return true;
        return path.startsWith('/') && path.length > 1;
    };

    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setTestResult('');

        try {
            const testUrl = serverBaseUrl.replace(/\/+$/, '') + '/health';
            const response = await fetch(testUrl, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                setTestResult('Health check successful');
            } else {
                setTestResult(`Health check failed: ${response.status}`);
            }
        } catch (error) {
            setTestResult(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setTestingConnection(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">Server Base URL</h3>

                <div className="form-group">
                    <label htmlFor="serverBaseUrl">Server Base URL</label>
                    <div className="flex space-x-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                id="serverBaseUrl"
                                value={serverBaseUrl}
                                onChange={(e) => onServerBaseUrlChange(e.target.value)}
                                placeholder={endpointSameAsBase ? "https://api.githubcopilot.com/mcp" : "http://localhost:3000"}
                                disabled={disabled}
                                className="w-full"
                            />
                            {serverBaseUrl && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                    {isValidUrl(serverBaseUrl) ? (
                                        <CheckCircle className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={testConnection}
                            disabled={testingConnection || !serverBaseUrl || !isValidUrl(serverBaseUrl)}
                            className="btn btn-outline"
                        >
                            {testingConnection ? 'Testing...' : 'Test'}
                        </button>
                    </div>

                    <div className="text-xs text-gray-600 mt-1">
                        {endpointSameAsBase
                            ? 'Complete MCP server URL (e.g., https://api.githubcopilot.com/mcp)'
                            : 'Base URL of your server (e.g., http://localhost:3000)'
                        }
                    </div>
                    {testResult && (
                        <div className={`text-xs mt-1 ${testResult.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="text-sm font-medium mb-3">MCP Protocol Endpoint Configuration</h3>

                <div className="form-group">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={endpointSameAsBase}
                            onChange={(e) => {
                                onEndpointSameAsBaseChange(e.target.checked);
                                if (e.target.checked) {
                                    onMcpEndpointPathChange('');
                                } else {
                                    onMcpEndpointPathChange('/api/mcp');
                                }
                            }}
                            disabled={disabled}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm">MCP endpoint is the same as Server Base URL</span>
                    </label>
                    <div className="text-xs text-gray-600 mt-1">
                        Check this if your MCP server URL is complete (e.g., https://api.githubcopilot.com/mcp)
                    </div>
                </div>

                {!endpointSameAsBase && (
                    <div className="form-group">
                        <label htmlFor="mcpEndpointPath">MCP Protocol Endpoint Path</label>
                        <div className="relative">
                            <input
                                type="text"
                                id="mcpEndpointPath"
                                value={mcpEndpointPath}
                                onChange={(e) => onMcpEndpointPathChange(e.target.value)}
                                placeholder="/api/mcp"
                                disabled={disabled}
                                className="w-full"
                            />
                            {mcpEndpointPath && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                    {isValidPath(mcpEndpointPath) ? (
                                        <CheckCircle className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                            Path to append to the base URL (must start with /)
                        </div>
                    </div>
                )}

                <div className="mt-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Complete MCP URL:</div>
                    <div className="font-mono text-xs bg-gray-50 p-2 rounded border break-all">
                        {getFullMcpUrl() || 'Enter Server Base URL first'}
                    </div>
                </div>
            </div>
        </div>
    );
};