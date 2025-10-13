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

/*
    OAuth scope error message when scopes are not assigned to the client
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ScopeErrorAlertProps {
    invalidScopes: string[];
    currentScope: string;
    onDiscover: () => void;
    onDismiss: () => void;
}

export const ScopeErrorAlert: React.FC<ScopeErrorAlertProps> = ({
                                                                    invalidScopes,
                                                                    currentScope,
                                                                    onDiscover,
                                                                    onDismiss
                                                                }) => {
    return (
        <div className="card mb-4 border-l-4 border-red-500 bg-red-50">
            <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 mb-2">
                        OAuth Scope Configuration Error
                    </h4>

                    <div className="mb-3">
                        <p className="text-xs text-red-800 mb-2">
                            The following scopes are not available for your OAuth client:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {invalidScopes.map((scope, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-1 bg-red-200 text-red-900 rounded text-xs font-mono"
                                >
                                    {scope}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white border border-red-200 rounded p-3 mb-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">Current Scope Configuration:</p>
                        <p className="text-xs font-mono text-gray-900 break-words">{currentScope}</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-300 rounded p-3 mb-3">
                        <p className="text-xs font-semibold text-blue-900 mb-2">ℹ️ What This Means:</p>
                        <p className="text-xs text-blue-800 mb-2">
                            These scopes may exist in your OAuth provider (like Keycloak), but they are <strong>not assigned</strong> to your specific client.
                        </p>
                        <p className="text-xs text-blue-800">
                            Each OAuth client has its own set of allowed scopes. Your client can only request scopes that have been explicitly assigned to it.
                        </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-3">
                        <p className="text-xs font-semibold text-yellow-900 mb-2">💡 How to Fix:</p>
                        <ol className="list-decimal list-inside space-y-2 text-xs text-yellow-800">
                            <li>
                                <strong>Quick Fix:</strong> Click the "Discover" button below to automatically find and use only the scopes assigned to your client
                            </li>
                            <li>
                                <strong>Keycloak Users:</strong> Go to Admin Console → Clients → [Your Client ID] → Client Scopes tab
                                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                    <li>Click "Add client scope"</li>
                                    <li>Select the scopes you need (e.g., {invalidScopes.join(', ')})</li>
                                    <li>Choose "Default" (always included) or "Optional" (must be requested)</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Other OAuth Providers:</strong> Check your provider's documentation for how to assign scopes/permissions to your client
                            </li>
                            <li>
                                <strong>Remove Invalid Scopes:</strong> Manually edit the scope field above to remove: {invalidScopes.join(', ')}
                            </li>
                        </ol>
                    </div>

                    <div className="bg-gray-100 border border-gray-300 rounded p-3 mb-3">
                        <p className="text-xs font-semibold text-gray-800 mb-2">📋 Common Valid Scopes:</p>
                        <div className="text-xs text-gray-700 space-y-1">
                            <div>• <code className="bg-white px-1 rounded">openid</code> - Required for OpenID Connect</div>
                            <div>• <code className="bg-white px-1 rounded">profile</code> - User profile information</div>
                            <div>• <code className="bg-white px-1 rounded">email</code> - Email address</div>
                            <div className="text-gray-600 italic mt-2">
                                Note: Your client may have additional custom scopes assigned. Use Discovery to find them.
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={onDiscover}
                            className="btn-outline btn-small flex items-center space-x-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            <span>Discover Valid Scopes</span>
                        </button>
                        <button
                            onClick={onDismiss}
                            className="btn-outline btn-small"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};