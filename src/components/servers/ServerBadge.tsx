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
import { Server } from 'lucide-react';

interface ServerBadgeProps {
    serverName: string;
    serverColor?: string;
    size?: 'small' | 'medium';
    showIcon?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
    amber: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    pink: { bg: '#fce7f3', text: '#9f1239', border: '#f9a8d4' },
    indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    cyan: { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
    gray: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
};

export const ServerBadge: React.FC<ServerBadgeProps> = ({
                                                            serverName,
                                                            serverColor = 'gray',
                                                            size = 'small',
                                                            showIcon = true
                                                        }) => {
    const colors = COLOR_MAP[serverColor] || COLOR_MAP.gray;

    const sizeClasses = size === 'small'
        ? 'px-1.5 py-0.5 text-xs'
        : 'px-2 py-1 text-sm';

    const iconSize = size === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3';

    return (
        <span
            className={`inline-flex items-center space-x-1 rounded border font-medium ${sizeClasses}`}
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
                borderColor: colors.border
            }}
            title={`From server: ${serverName}`}
        >
            {showIcon && <Server className={iconSize} />}
            <span>{serverName}</span>
        </span>
    );
};

interface ToolCallServerBadgeProps {
    serverName: string;
    serverColor?: string;
    toolName: string;
}

export const ToolCallServerBadge: React.FC<ToolCallServerBadgeProps> = ({
                                                                            serverName,
                                                                            serverColor,
                                                                            toolName
                                                                        }) => {
    return (
        <div className="flex items-center space-x-2 text-xs text-gray-600 mb-1">
            <span>Tool executed on:</span>
            <ServerBadge
                serverName={serverName}
                serverColor={serverColor}
                size="small"
                showIcon={true}
            />
            <span className="font-mono text-primary-600">{toolName}</span>
        </div>
    );
};

interface AttachmentServerBadgeProps {
    attachments: Array<{
        name: string;
        serverId: string;
        serverName: string;
        serverColor?: string;
    }>;
}

export const AttachmentServerBadge: React.FC<AttachmentServerBadgeProps> = ({
                                                                                attachments
                                                                            }) => {
    // Group by server
    const byServer = attachments.reduce((acc, att) => {
        if (!acc[att.serverId]) {
            acc[att.serverId] = {
                serverName: att.serverName,
                serverColor: att.serverColor,
                count: 0
            };
        }
        acc[att.serverId].count++;
        return acc;
    }, {} as Record<string, { serverName: string; serverColor?: string; count: number }>);

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {Object.values(byServer).map((server, idx) => (
                <div key={idx} className="flex items-center space-x-1">
                    <ServerBadge
                        serverName={server.serverName}
                        serverColor={server.serverColor}
                        size="small"
                    />
                    <span className="text-xs text-gray-500">
                        ({server.count})
                    </span>
                </div>
            ))}
        </div>
    );
};