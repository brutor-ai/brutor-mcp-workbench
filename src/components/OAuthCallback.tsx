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

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, XCircle } from 'lucide-react';

interface ScopeError {
    error: string;
    error_description: string;
    invalid_scopes?: string[];
}

export const OAuthCallback: React.FC = () => {
    const [error, setError] = useState<ScopeError | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('error')) {
            const errorType = urlParams.get('error') || 'unknown_error';
            const errorDescription = urlParams.get('error_description') || 'Unknown error occurred';

            console.error('OAuth error:', errorDescription);

            // Parse invalid scopes from error description
            let invalidScopes: string[] = [];
            const scopeMatch = errorDescription.match(/Invalid scopes?:\s*(.+)/i);
            if (scopeMatch) {
                invalidScopes = scopeMatch[1].split(/[\s,]+/).filter(s => s.trim());
            }

            setError({
                error: errorType,
                error_description: errorDescription,
                invalid_scopes: invalidScopes
            });
            setIsProcessing(false);

            // Redirect to config tab with error details after 5 seconds
            setTimeout(() => {
                const errorParams = new URLSearchParams({
                    tab: 'config',
                    error: 'oauth_scope_error',
                    invalid_scopes: invalidScopes.join(',')
                });
                window.location.href = `/?${errorParams.toString()}`;
            }, 5000);

        } else if (urlParams.has('code')) {
            console.log('OAuth authorization code received, processing...');

            // Redirect back to main app with the OAuth parameters preserved
            setTimeout(() => {
                window.location.href = `/?tab=config&${window.location.search.substring(1)}`;
            }, 1000);
        }
    }, []);

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="max-w-2xl w-full mx-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 border-l-4 border-red-500">
                        <div className="flex items-start space-x-4">
                            <XCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold text-red-900 mb-2">
                                    OAuth Authentication Failed
                                </h2>

                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <p className="text-sm font-medium text-red-900 mb-1">Error Type:</p>
                                    <p className="text-sm text-red-800 font-mono">{error.error}</p>
                                </div>

                                {error.invalid_scopes && error.invalid_scopes.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-semibold text-gray-900 mb-2">
                                            Invalid Scopes Detected:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {error.invalid_scopes.map((scope, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-mono"
                                                >
                          {scope}
                        </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <p className="text-sm font-semibold text-yellow-900 mb-2">
                                        💡 How to Fix This:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
                                        <li>Go to the OAuth configuration tab</li>
                                        <li>Click the "Discover" button to auto-detect valid scopes</li>
                                        <li>Or manually update the scope field with valid values</li>
                                        <li>Common valid scopes: <code className="bg-yellow-100 px-1 rounded">openid</code>, <code className="bg-yellow-100 px-1 rounded">profile</code>, <code className="bg-yellow-100 px-1 rounded">email</code></li>
                                    </ol>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-xs font-medium text-gray-700 mb-1">Full Error Description:</p>
                                    <p className="text-xs text-gray-600 font-mono break-words">
                                        {error.error_description}
                                    </p>
                                </div>

                                <div className="mt-4 text-sm text-gray-600">
                                    Redirecting to configuration in 5 seconds...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-900 mb-2">Processing login...</div>
                <div className="text-sm text-gray-600">Please wait while we complete your authentication</div>
            </div>
        </div>
    );
};