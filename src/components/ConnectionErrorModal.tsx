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

import React from 'react';
import { X, AlertCircle, Server, Shield } from 'lucide-react';

interface ConnectionErrorModalProps {
    error: any;
    onClose: () => void;
    mcpEndpointPath?: string;
    serverBaseUrl?: string;
}

export const ConnectionErrorModal: React.FC<ConnectionErrorModalProps> = ({ error, onClose, mcpEndpointPath, serverBaseUrl }) => {
    if (!error) return null;

    const isCorsError = (error as any).isCorsError;
    const isConnectionRefused = (error as any).isConnectionRefused;
    const clientOrigin = (error as any).clientOrigin;
    const serverUrl = (error as any).serverUrl;

    // Detect 404 errors - check both message and response
    const errorMessage = error?.message || String(error);
    const is404Error =
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found') ||
        errorMessage.toLowerCase().includes('http 404');
    const isPostError = errorMessage.includes('POST') || errorMessage.includes('endpoint');

    console.log('Error detection:', {
        errorMessage,
        is404Error,
        isPostError,
        isCorsError,
        isConnectionRefused
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-3">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            {isCorsError ? 'CORS Policy Error' :
                                isConnectionRefused ? 'Connection Refused' :
                                    is404Error ? 'MCP Endpoint Not Found (404)' :
                                        'Connection Failed'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isCorsError && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-red-900 mb-2">
                                        Browser Security Blocked This Connection
                                    </h3>
                                    <p className="text-sm text-red-800 mb-3">
                                        The browser blocked the connection due to CORS (Cross-Origin Resource Sharing)
                                        policy restrictions. This is a security feature that prevents unauthorized access
                                        between different origins.
                                    </p>

                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 font-mono text-xs space-y-1">
                                        <div><strong>Client Origin:</strong> {clientOrigin}</div>
                                        <div><strong>Server URL:</strong> {serverUrl}</div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="font-medium text-sm mb-2 text-gray-900">To fix this issue, your MCP Server must:</p>
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-2">
                                            <li>Support CORS by sending appropriate response headers</li>
                                            <li>Allow requests from: <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">{clientOrigin}</code></li>
                                            <li>Handle preflight OPTIONS requests correctly</li>
                                            <li>Not redirect preflight requests (common misconfiguration)</li>
                                        </ol>
                                    </div>

                                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="font-medium text-sm mb-2 text-gray-900">Required CORS Headers:</p>
                                        <div className="font-mono text-xs space-y-1 text-gray-800 bg-white p-3 rounded border">
                                            <div>Access-Control-Allow-Origin: {clientOrigin}</div>
                                            <div>Access-Control-Allow-Methods: GET, POST, OPTIONS</div>
                                            <div>Access-Control-Allow-Headers: Content-Type, Authorization</div>
                                            <div>Access-Control-Max-Age: 86400</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-800">
                                            <strong>💡 Tip:</strong> If you're running a local server, make sure it's configured
                                            to accept requests from {clientOrigin}. Many development servers have CORS disabled
                                            by default for security reasons.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {isConnectionRefused && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <Server className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-orange-900 mb-2">
                                        Unable to Reach the Server
                                    </h3>
                                    <p className="text-sm text-orange-800 mb-3">
                                        The connection was refused. The server appears to be unavailable, not running,
                                        or the port is blocked.
                                    </p>

                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 font-mono text-xs space-y-1">
                                        <div><strong>Server URL:</strong> {serverUrl}</div>
                                        <div><strong>Error:</strong> Connection refused (ERR_CONNECTION_REFUSED)</div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="font-medium text-sm mb-2 text-gray-900">Common causes and solutions:</p>
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-2">
                                            <li><strong>Server not running:</strong> Start your MCP server</li>
                                            <li><strong>Wrong URL/port:</strong> Verify the server URL and port number are correct</li>
                                            <li><strong>Firewall blocking:</strong> Check if a firewall is blocking the connection</li>
                                            <li><strong>Server crashed:</strong> Check server logs for errors</li>
                                            <li><strong>Wrong protocol:</strong> Ensure you're using http:// for local servers (not https://)</li>
                                        </ol>
                                    </div>

                                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="font-medium text-sm mb-2 text-gray-900">Quick diagnostic checklist:</p>
                                        <div className="text-sm space-y-1 text-gray-700">
                                            <div>✓ Is the server process running?</div>
                                            <div>✓ Can you access {serverUrl} directly in a browser?</div>
                                            <div>✓ Are you using the correct port number?</div>
                                            <div>✓ Check server console/logs for startup errors</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isCorsError && !isConnectionRefused && (
                        <div className="space-y-4">
                            {is404Error ? (
                                // 404 Error - Endpoint Not Found
                                <div className="flex items-start space-x-3">
                                    <Server className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-amber-900 mb-2">
                                            MCP Endpoint Not Found (404)
                                        </h3>
                                        <p className="text-sm text-amber-800 mb-3">
                                            The server returned a 404 error, which means the MCP endpoint path is incorrect
                                            or doesn't exist on the server.
                                        </p>

                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                                            <div className="text-sm">
                                                <strong className="text-amber-900">Current Configuration:</strong>
                                            </div>
                                            <div className="font-mono text-xs space-y-1 pl-2">
                                                {serverBaseUrl && (
                                                    <div><strong>Server Base URL:</strong> {serverBaseUrl}</div>
                                                )}
                                                {mcpEndpointPath && (
                                                    <div><strong>MCP Endpoint Path:</strong> {mcpEndpointPath}</div>
                                                )}
                                                {serverBaseUrl && mcpEndpointPath && (
                                                    <div className="pt-1 border-t border-amber-300 mt-2">
                                                        <strong>Full URL Attempted:</strong> {serverBaseUrl.replace(/\/+$/, '')}{mcpEndpointPath === 'same as base URL' ? '' : mcpEndpointPath}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="text-xs text-gray-600 mb-1">Server Response:</div>
                                            <p className="text-sm text-red-900 font-mono break-all">
                                                {errorMessage}
                                            </p>
                                        </div>

                                        <div className="mt-4">
                                            <p className="font-medium text-sm mb-2 text-gray-900">
                                                Please check your MCP Protocol Endpoint configuration:
                                            </p>
                                            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 ml-2">
                                                <li>
                                                    <strong>Is the endpoint path correct?</strong> Common paths are:
                                                    <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                                                        <li><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/api/mcp</code></li>
                                                        <li><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/mcp</code></li>
                                                        <li><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/v1/mcp</code></li>
                                                        <li><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/</code> (root path)</li>
                                                    </ul>
                                                </li>
                                                <li>
                                                    <strong>Check your server documentation</strong> for the correct MCP endpoint path
                                                </li>
                                                <li>
                                                    <strong>Verify the server is running</strong> and has the MCP endpoint configured
                                                </li>
                                                <li>
                                                    If using a complete URL, check <strong>"MCP endpoint is the same as Server Base URL"</strong> in the configuration
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-xs text-blue-800">
                                                <strong>💡 Tip:</strong> If your MCP server is at a complete URL like
                                                <code className="bg-blue-100 px-1 rounded mx-1">https://api.example.com/mcp</code>,
                                                enable the "MCP endpoint is the same as Server Base URL" checkbox and put the
                                                complete URL in the Server Base URL field.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Generic Error
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-red-900 mb-2">
                                            Connection Error
                                        </h3>
                                        <p className="text-sm text-red-800 mb-3">
                                            An error occurred while trying to connect to the MCP server.
                                        </p>

                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-sm text-red-900 font-mono break-all">
                                                {errorMessage || 'Unknown error occurred'}
                                            </p>
                                        </div>

                                        <div className="mt-4">
                                            <p className="font-medium text-sm mb-2 text-gray-900">Troubleshooting steps:</p>
                                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                                <li>Verify the server URL is correct</li>
                                                <li>Check if the server is running</li>
                                                <li>Review server logs for errors</li>
                                                <li>Ensure network connectivity</li>
                                                <li>Check authentication settings if OAuth is enabled</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};