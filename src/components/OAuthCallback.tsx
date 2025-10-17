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
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export const OAuthCallback: React.FC = () => {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Processing OAuth callback...');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        console.log('🔵 OAuth Callback Page:', {
            hasCode: !!code,
            hasState: !!state,
            hasError: !!error,
            state
        });

        // Extract server ID from state parameter
        let serverId: string | null = null;
        if (state && state.includes(':')) {
            [, serverId] = state.split(':');
        }

        // Check if we have a window.opener (popup mode)
        if (window.opener && !window.opener.closed) {
            console.log('✅ Popup mode detected - sending message to opener');

            try {
                // Handle error case
                if (error) {
                    console.error('❌ OAuth error:', error, errorDescription);

                    // Send error message to opener
                    window.opener.postMessage({
                        type: 'oauth-callback',
                        serverId: serverId || 'unknown',
                        error: error,
                        error_description: errorDescription,
                        invalid_scopes: urlParams.get('invalid_scopes')?.split(',') || []
                    }, window.location.origin);

                    setStatus('error');
                    setMessage(`Authentication failed: ${errorDescription || error}`);

                    // Close popup after delay
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                    return;
                }

                // Handle success case
                if (code && state) {
                    console.log('✅ OAuth code received, sending to opener');

                    // Send success message to opener
                    window.opener.postMessage({
                        type: 'oauth-callback',
                        serverId: serverId || 'unknown',
                        code: code,
                        state: state
                    }, window.location.origin);

                    setStatus('success');
                    setMessage('Authentication successful! Closing popup...');

                    // Close popup after short delay
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                    return;
                }

                // Neither code nor error - shouldn't happen
                console.warn('⚠️ Callback page loaded without code or error');
                setStatus('error');
                setMessage('Invalid callback - missing authorization code');

                setTimeout(() => {
                    window.close();
                }, 2000);

            } catch (err) {
                console.error('❌ Failed to communicate with opener:', err);
                setStatus('error');
                setMessage('Failed to communicate with main window');
            }
        } else {
            // No opener - this might be a redirect-based flow or opened in new tab
            console.log('⚠️ No window.opener - redirecting to main app');

            // Redirect to main app with parameters preserved
            const params = new URLSearchParams(window.location.search);
            params.set('tab', 'connect');
            window.location.href = `/?${params.toString()}`;
        }
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-sky-50">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white rounded-lg shadow-xl p-8 border-l-4"
                     style={{ borderColor: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#3b82f6' }}>
                    <div className="flex flex-col items-center space-y-4">
                        {/* Icon */}
                        <div className="flex items-center justify-center">
                            {status === 'processing' && (
                                <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
                            )}
                            {status === 'success' && (
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            )}
                            {status === 'error' && (
                                <XCircle className="w-12 h-12 text-red-600" />
                            )}
                        </div>

                        {/* Message */}
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                {status === 'processing' && 'Processing...'}
                                {status === 'success' && 'Success!'}
                                {status === 'error' && 'Error'}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {message}
                            </p>
                        </div>

                        {/* Progress indicator for processing */}
                        {status === 'processing' && (
                            <div className="w-full">
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-600 animate-pulse" style={{ width: '60%' }} />
                                </div>
                            </div>
                        )}

                        {/* Additional info */}
                        <div className="text-xs text-gray-500 text-center">
                            {status === 'processing' && 'Completing authentication...'}
                            {status === 'success' && 'This window will close automatically'}
                            {status === 'error' && 'Please try again or contact support'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};