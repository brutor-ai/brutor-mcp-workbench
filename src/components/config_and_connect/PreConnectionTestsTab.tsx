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

interface PreConnectionTestsTabProps {
    enablePortCheck: boolean;
    onEnablePortCheckChange: (enabled: boolean) => void;
    enableCorsCheck: boolean;
    onEnableCorsCheckChange: (enabled: boolean) => void;
    enableHealthCheck: boolean;
    onEnableHealthCheckChange: (enabled: boolean) => void;
    disabled: boolean;
}

export const PreConnectionTestsTab: React.FC<PreConnectionTestsTabProps> = ({
                                                                                enablePortCheck,
                                                                                onEnablePortCheckChange,
                                                                                enableCorsCheck,
                                                                                onEnableCorsCheckChange,
                                                                                enableHealthCheck,
                                                                                onEnableHealthCheckChange,
                                                                                disabled
                                                                            }) => {
    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">Pre-Connection Tests</h3>
                <p className="text-xs text-gray-600 mb-4">
                    Configure which tests to run before attempting MCP connection. These tests help diagnose connection issues.
                </p>

                <div className="space-y-3">
                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enablePortCheck}
                                onChange={(e) => onEnablePortCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable port connectivity test</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enablePortCheck
                                ? 'Tests if the server is reachable at the specified URL and port'
                                : 'Skip port test - connection may fail without clear error message'
                            }
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableCorsCheck}
                                onChange={(e) => onEnableCorsCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable CORS configuration test</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enableCorsCheck
                                ? 'Verifies CORS headers allow requests from this origin'
                                : 'Skip CORS test - may result in unclear CORS errors'
                            }
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableHealthCheck}
                                onChange={(e) => onEnableHealthCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable health endpoint test (/health)</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enableHealthCheck
                                ? 'Tests if /health endpoint responds correctly'
                                : 'Skip health test - some servers don\'t provide /health endpoint'
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
                <h4 className="text-xs font-medium text-blue-900 mb-2">💡 Recommendation</h4>
                <p className="text-xs text-blue-800">
                    Keep Port and CORS tests enabled for best error diagnosis. Disable Health test only if your server doesn't provide a /health endpoint.
                </p>
            </div>
        </div>
    );
};