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
    const [debugInfo, setDebugInfo] = useState<any>(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Capture ALL query parameters for debugging
        const allParams: Record<string, string> = {};
        urlParams.forEach((value, key) => {
            allParams[key] = value;
        });

        // CRITICAL: Check opener early and store reference
        const hasOpener = !!(window.opener && !window.opener.closed);
        const openerOrigin = window.location.origin;

        const debug = {
            url: window.location.href,
            hasCode: !!code,
            hasState: !!state,
            hasError: !!error,
            state: state,
            allParams: allParams,
            hasOpener: hasOpener,
            origin: openerOrigin,
            timestamp: new Date().toISOString()
        };

        console.log('🔵 OAuth Callback Page - Full Debug:', debug);
        setDebugInfo(debug);

        // Extract server ID from state parameter
        let serverId: string | null = null;
        if (state && state.includes(':')) {
            const parts = state.split(':');
            serverId = parts[1];
            console.log('🔍 Extracted serverId from state:', serverId);
        } else if (state) {
            serverId = 'default';
            console.log('⚠️ State parameter exists but no colon separator, using default serverId');
        }

        // CRITICAL FIX: Store callback data in localStorage as backup
        // This handles cases where window.opener is lost due to redirect chains
        if (code || error) {
            const callbackData = {
                code: code || undefined,
                state: state || undefined,
                error: error || undefined,
                error_description: errorDescription || undefined,
                serverId: serverId || 'unknown',
                timestamp: Date.now()
            };

            console.log('💾 Storing callback data in localStorage as backup:', callbackData);
            localStorage.setItem('oauth_callback_data', JSON.stringify(callbackData));
        }

        // Check if we have a window.opener (popup mode)
        if (hasOpener) {
            console.log('✅ Popup mode detected - window.opener is available');

            try {
                // Handle error case
                if (error) {
                    console.error('❌ OAuth error:', error, errorDescription);

                    const errorMessage = {
                        type: 'oauth-callback',
                        serverId: serverId || 'unknown',
                        error: error,
                        error_description: errorDescription || error,
                        invalid_scopes: urlParams.get('invalid_scopes')?.split(',') || []
                    };

                    console.log('📤 Sending error message to opener:', errorMessage);

                    // Send error message to opener
                    window.opener.postMessage(errorMessage, openerOrigin);

                    setStatus('error');
                    setMessage(`Authentication failed: ${errorDescription || error}`);

                    // Close popup after delay
                    console.log('⏱️ Closing popup in 3 seconds...');
                    setTimeout(() => {
                        console.log('🚪 Attempting to close popup window');
                        window.close();
                    }, 3000);
                    return;
                }

                // Handle success case
                if (code) {
                    console.log('✅ OAuth code received');
                    console.log('📊 Code length:', code.length);
                    console.log('📊 State:', state);

                    const successMessage = {
                        type: 'oauth-callback',
                        serverId: serverId || 'unknown',
                        code: code,
                        state: state || ''
                    };

                    console.log('📤 Sending success message to opener:', {
                        ...successMessage,
                        code: code.substring(0, 10) + '...' // Don't log full code
                    });

                    // CRITICAL: Send message multiple times to ensure delivery
                    // Some browsers/providers have timing issues with postMessage
                    window.opener.postMessage(successMessage, openerOrigin);

                    // Send again after short delay
                    setTimeout(() => {
                        console.log('📤 Sending message again (redundancy)');
                        window.opener.postMessage(successMessage, openerOrigin);
                    }, 100);

                    setStatus('success');
                    setMessage('Authentication successful! Closing popup...');

                    // IMPORTANT: Add a longer delay to ensure message is received
                    console.log('⏱️ Closing popup in 2 seconds...');
                    setTimeout(() => {
                        console.log('🚪 Attempting to close popup window');

                        // Try to close
                        try {
                            window.close();
                        } catch (e) {
                            console.error('Failed to close with window.close():', e);
                        }

                        // Fallback: try to signal opener to close us
                        try {
                            if (window.opener && !window.opener.closed) {
                                window.opener.postMessage({
                                    type: 'oauth-popup-close-request',
                                    serverId: serverId || 'unknown'
                                }, openerOrigin);
                            }
                        } catch (e) {
                            console.error('Failed to send close request:', e);
                        }
                    }, 2000);
                    return;
                }

                // Neither code nor error - shouldn't happen
                console.warn('⚠️ Callback page loaded without code or error');
                console.log('📋 Available params:', allParams);

                setStatus('error');
                setMessage('Invalid callback - missing authorization code');

                setTimeout(() => {
                    window.close();
                }, 3000);

            } catch (err) {
                console.error('❌ Failed to communicate with opener:', err);
                setStatus('error');
                setMessage('Failed to communicate with main window');

                // Still try to close after error
                setTimeout(() => {
                    window.close();
                }, 3000);
            }
        } else {
            // NO OPENER - This is the HubSpot issue!
            // Window.opener was lost during redirect chain
            console.warn('⚠️ No window.opener - likely lost during redirect chain (HubSpot issue)');
            console.log('💡 Attempting fallback: Store data and close window');

            if (code) {
                setStatus('success');
                setMessage('Authentication successful! Data stored. Please close this window.');

                // Notify user to manually close and check main window
                console.log('📢 User needs to manually check main application');

                // Try to close anyway after delay
                setTimeout(() => {
                    console.log('🚪 Attempting to close (may not work without opener)');
                    window.close();

                    // If still open, show instructions
                    if (!window.closed) {
                        setMessage('Authentication complete! Please close this window manually and return to the main application.');
                    }
                }, 3000);
            } else if (error) {
                setStatus('error');
                setMessage(`Authentication failed: ${errorDescription || error}. Please close this window.`);

                setTimeout(() => {
                    window.close();
                }, 3000);
            } else {
                // Last resort: redirect to main app
                console.log('⚠️ No opener and no code - redirecting to main app');
                const params = new URLSearchParams(window.location.search);
                params.set('tab', 'connect');

                setMessage('Redirecting to main application...');

                setTimeout(() => {
                    window.location.href = `/?${params.toString()}`;
                }, 1000);
            }
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

                        {/* Manual close instruction if needed */}
                        {status === 'success' && !debugInfo?.hasOpener && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-xs text-blue-700 text-center">
                                    If this window doesn't close automatically, please close it manually and return to the main application.
                                </p>
                            </div>
                        )}

                        {/* Additional info */}
                        <div className="text-xs text-gray-500 text-center">
                            {status === 'processing' && 'Completing authentication...'}
                            {status === 'success' && debugInfo?.hasOpener && 'This window will close automatically'}
                            {status === 'success' && !debugInfo?.hasOpener && 'Please close this window manually'}
                            {status === 'error' && 'Please try again or contact support'}
                        </div>

                        {/* Debug info in development */}
                        {import.meta.env.DEV && debugInfo && (
                            <details className="mt-4 w-full">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                    Debug Info (Dev Only)
                                </summary>
                                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-48">
                                    {JSON.stringify(debugInfo, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};