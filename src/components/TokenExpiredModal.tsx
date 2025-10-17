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
import { AlertTriangle, X, RefreshCw, LogOut } from 'lucide-react';

interface TokenExpiredModalProps {
    serverName: string;
    serverId: string;
    onReconnect: () => void;
    onDisconnect: () => void;
    onClose: () => void;
}

export const TokenExpiredModal: React.FC<TokenExpiredModalProps> = ({
                                                                        serverName,
                                                                        serverId,
                                                                        onReconnect,
                                                                        onDisconnect,
                                                                        onClose
                                                                    }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-amber-50">
                    <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                        <h2 className="text-lg font-semibold text-amber-900">
                            Session Expired
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
                    <div className="mb-4">
                        <p className="text-gray-900 font-medium mb-2">
                            Your authentication token has expired for:
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="font-semibold text-gray-900">{serverName}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="text-sm text-blue-900">
                            <div className="font-medium mb-2">ℹ️ What happened?</div>
                            <ul className="list-disc list-inside space-y-1 text-blue-800">
                                <li>Your OAuth token has expired</li>
                                <li>The server rejected your request (HTTP 401)</li>
                                <li>You need to re-authenticate to continue</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="text-sm text-amber-900">
                            <div className="font-medium mb-2">💡 What should you do?</div>
                            <ul className="list-disc list-inside space-y-1 text-amber-800">
                                <li><strong>Reconnect:</strong> Re-authenticate to get a new token</li>
                                <li><strong>Disconnect:</strong> Close the connection if you're done</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between space-x-3 p-4 border-t bg-gray-50">
                    <button
                        onClick={onDisconnect}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center justify-center space-x-2"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Disconnect</span>
                    </button>
                    <button
                        onClick={onReconnect}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center justify-center space-x-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Reconnect</span>
                    </button>
                </div>
            </div>
        </div>
    );
};