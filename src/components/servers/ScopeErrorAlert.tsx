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
import { AlertCircle, X } from 'lucide-react';

interface ScopeErrorAlertProps {
    error: string;
    onDismiss: () => void;
}

export const ScopeErrorAlert: React.FC<ScopeErrorAlertProps> = ({ error, onDismiss }) => {
    // Safety check for undefined error
    if (!error) {
        return null;
    }

    const isScopeError = error.toLowerCase().includes('scope');

    if (!isScopeError) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-red-900 mb-1">OAuth Error</h3>
                        <p className="text-sm text-red-800 break-words">{error}</p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-red-600 hover:text-red-800 flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
                        title="Dismiss error"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-amber-900">Invalid Scope Configuration</h3>
                        <button
                            onClick={onDismiss}
                            className="text-amber-600 hover:text-amber-800 flex-shrink-0 p-1 hover:bg-amber-100 rounded transition-colors"
                            title="Dismiss error"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-sm text-amber-800 mb-3 break-words">{error}</p>

                    <div className="bg-amber-100 border border-amber-300 rounded-md p-3 mb-3">
                        <h4 className="text-xs font-semibold text-amber-900 mb-2">How to fix this:</h4>
                        <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                            <li>Click the "Discover" button to automatically find valid scopes</li>
                            <li>Or, in your OAuth provider (e.g., Keycloak):
                                <ul className="ml-6 mt-1 space-y-0.5 list-disc list-inside">
                                    <li>Go to Clients → [Your Client] → Client Scopes</li>
                                    <li>Click "Add client scope"</li>
                                    <li>Select the required scopes</li>
                                    <li>Choose "Default" or "Optional"</li>
                                </ul>
                            </li>
                            <li>Common required scopes: <code className="bg-amber-200 px-1 rounded">openid</code>, <code className="bg-amber-200 px-1 rounded">profile</code></li>
                        </ol>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onDismiss}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
                        >
                            I understand, dismiss
                        </button>
                        <span className="text-xs text-amber-700">
                            The error will be cleared when you reconnect
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};