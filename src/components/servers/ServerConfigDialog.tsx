/*
 * Server Configuration Dialog - For adding/editing MCP server configurations
 * FIXED: Proper state management and OAuth persistence
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Server } from 'lucide-react';
import { ServerConfig, OAuthConfig } from '../../types';
import { OAuthTab } from './OAuthTab.tsx';

interface ServerConfigDialogProps {
    server: ServerConfig | null; // null for new server
    onSave: (config: Omit<ServerConfig, 'id'>) => void;
    onClose: () => void;
}

const SERVER_COLORS = [
    { value: 'blue', label: 'Blue', hex: '#3b82f6' },
    { value: 'green', label: 'Green', hex: '#10b981' },
    { value: 'purple', label: 'Purple', hex: '#a855f7' },
    { value: 'amber', label: 'Amber', hex: '#f59e0b' },
    { value: 'red', label: 'Red', hex: '#ef4444' },
    { value: 'pink', label: 'Pink', hex: '#ec4899' },
    { value: 'indigo', label: 'Indigo', hex: '#6366f1' },
    { value: 'cyan', label: 'Cyan', hex: '#06b6d4' }
];

export const ServerConfigDialog: React.FC<ServerConfigDialogProps> = ({
                                                                          server,
                                                                          onSave,
                                                                          onClose
                                                                      }) => {
    console.log('🔵 ServerConfigDialog render:', {
        hasServer: !!server,
        serverName: server?.name,
        serverId: server?.id
    });

    // ============================================================================
    // STATE - Initialize from server prop
    // ============================================================================

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [endpointPath, setEndpointPath] = useState('/api/mcp');
    const [endpointSameAsBase, setEndpointSameAsBase] = useState(false);
    const [color, setColor] = useState('blue');
    const [enablePortCheck, setEnablePortCheck] = useState(true);
    const [enableCorsCheck, setEnableCorsCheck] = useState(true);
    const [enableHealthCheck, setEnableHealthCheck] = useState(true);
    const [enabled, setEnabled] = useState(true);
    const [oauthConfig, setOauthConfig] = useState<OAuthConfig>({
        enabled: false,
        flow: 'authorization_code_pkce',
        clientId: '',
        clientSecret: '',
        scope: 'openid profile'
    });

    const [activeSubTab, setActiveSubTab] = useState<'basic' | 'oauth' | 'tests'>('basic');

    // ============================================================================
    // EFFECT - Initialize/update state when server prop changes
    // ============================================================================

    useEffect(() => {
        console.log('🔄 ServerConfigDialog useEffect triggered');

        if (server) {
            console.log('📝 Loading server for editing:', {
                id: server.id,
                name: server.name,
                oauth: server.oauth
            });

            setName(server.name);
            setDescription(server.description || '');
            setBaseUrl(server.baseUrl);
            setEndpointPath(server.endpointPath || '/api/mcp');
            setEndpointSameAsBase(server.endpointSameAsBase || false);
            setColor(server.color || 'blue');
            setEnablePortCheck(server.enablePortCheck ?? true);
            setEnableCorsCheck(server.enableCorsCheck ?? true);
            setEnableHealthCheck(server.enableHealthCheck ?? true);
            setEnabled(server.enabled ?? true);

            // CRITICAL: Deep clone the OAuth config to avoid reference issues
            setOauthConfig({
                enabled: server.oauth?.enabled || false,
                flow: server.oauth?.flow || 'authorization_code_pkce',
                clientId: server.oauth?.clientId || '',
                clientSecret: server.oauth?.clientSecret || '',
                authEndpoint: server.oauth?.authEndpoint,
                tokenEndpoint: server.oauth?.tokenEndpoint,
                logoutEndpoint: server.oauth?.logoutEndpoint,
                postLogoutRedirectUri: server.oauth?.postLogoutRedirectUri,
                scope: server.oauth?.scope || 'openid profile'
            });

            console.log('✅ State loaded from server');
        } else {
            console.log('📝 Creating new server - resetting form');
            // Reset to defaults for new server
            setName('');
            setDescription('');
            setBaseUrl('');
            setEndpointPath('/api/mcp');
            setEndpointSameAsBase(false);
            setColor('blue');
            setEnablePortCheck(true);
            setEnableCorsCheck(true);
            setEnableHealthCheck(true);
            setEnabled(true);
            setOauthConfig({
                enabled: false,
                flow: 'authorization_code_pkce',
                clientId: '',
                clientSecret: '',
                scope: 'openid profile'
            });
        }
    }, [server]); // Re-run when server prop changes

    // ============================================================================
    // DEBUG: Log OAuth config changes
    // ============================================================================

    useEffect(() => {
        console.log('🔐 OAuth config state changed:', oauthConfig);
    }, [oauthConfig]);

    // ============================================================================
    // HANDLERS
    // ============================================================================

    const handleOAuthConfigChange = (newConfig: OAuthConfig) => {
        console.log('🔐 handleOAuthConfigChange called:', {
            oldEnabled: oauthConfig.enabled,
            newEnabled: newConfig.enabled,
            oldFlow: oauthConfig.flow,
            newFlow: newConfig.flow,
            newConfig
        });
        setOauthConfig(newConfig);
    };

    const handleSave = () => {
        console.log('💾 handleSave called - checking current state...');

        if (!name || !baseUrl) {
            alert('Name and Base URL are required');
            return;
        }

        console.log('📊 Current form state before save:', {
            name,
            description,
            baseUrl,
            endpointPath,
            endpointSameAsBase,
            oauthConfig,
            enablePortCheck,
            enableCorsCheck,
            enableHealthCheck,
            enabled,
            color
        });

        // Create complete config object with explicit field copying
        const config: Omit<ServerConfig, 'id'> = {
            name: name,
            description: description,
            baseUrl: baseUrl,
            endpointPath: endpointPath,
            endpointSameAsBase: endpointSameAsBase,
            oauth: {
                enabled: oauthConfig.enabled,
                flow: oauthConfig.flow,
                clientId: oauthConfig.clientId,
                clientSecret: oauthConfig.clientSecret,
                authEndpoint: oauthConfig.authEndpoint,
                tokenEndpoint: oauthConfig.tokenEndpoint,
                logoutEndpoint: oauthConfig.logoutEndpoint,
                postLogoutRedirectUri: oauthConfig.postLogoutRedirectUri,
                scope: oauthConfig.scope
            },
            enablePortCheck: enablePortCheck,
            enableCorsCheck: enableCorsCheck,
            enableHealthCheck: enableHealthCheck,
            enabled: enabled,
            color: color
        };

        console.log('✅ Final config object to save:', JSON.stringify(config, null, 2));
        console.log('🔐 OAuth config being saved:', {
            enabled: config.oauth.enabled,
            flow: config.oauth.flow,
            clientId: config.oauth.clientId,
            hasClientSecret: !!config.oauth.clientSecret,
            scope: config.oauth.scope,
            authEndpoint: config.oauth.authEndpoint,
            tokenEndpoint: config.oauth.tokenEndpoint
        });

        onSave(config);
    };

    const handleClose = () => {
        console.log('🚪 Dialog closing');
        onClose();
    };

    const getFullMcpUrl = () => {
        if (!baseUrl) return '';
        if (endpointSameAsBase) return baseUrl;
        return `${baseUrl.replace(/\/+$/, '')}${endpointPath}`;
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-3">
                        <Server className="w-6 h-6 text-primary-600" />
                        <h2 className="text-lg font-semibold">
                            {server ? `Edit Server: ${server.name}` : 'Add New MCP Server'}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-tabs */}
                <div className="flex border-b">
                    {[
                        { id: 'basic', label: 'Basic' },
                        { id: 'oauth', label: 'OAuth' },
                        { id: 'tests', label: 'Pre-Tests' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                console.log(`🔄 Switching to ${tab.id} tab`);
                                setActiveSubTab(tab.id as any);
                            }}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeSubTab === tab.id
                                    ? 'border-b-2 border-primary-500 text-primary-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* BASIC TAB */}
                    {activeSubTab === 'basic' && (
                        <div className="space-y-4">
                            <div className="form-group">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Server Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., GitHub MCP Server"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What this server provides..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                    Server Base URL *
                                </label>
                                <input
                                    type="text"
                                    id="baseUrl"
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                    placeholder="http://localhost:3000"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={endpointSameAsBase}
                                        onChange={(e) => setEndpointSameAsBase(e.target.checked)}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-gray-700">MCP endpoint is same as base URL</span>
                                </label>
                            </div>

                            {!endpointSameAsBase && (
                                <div className="form-group">
                                    <label htmlFor="endpointPath" className="block text-sm font-medium text-gray-700 mb-1">
                                        MCP Endpoint Path
                                    </label>
                                    <input
                                        type="text"
                                        id="endpointPath"
                                        value={endpointPath}
                                        onChange={(e) => setEndpointPath(e.target.value)}
                                        placeholder="/api/mcp"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                </div>
                            )}

                            <div className="p-3 bg-sky-50 rounded border border-sky-200">
                                <div className="text-xs font-medium text-gray-700 mb-1">
                                    Complete MCP URL:
                                </div>
                                <div className="text-sm font-mono text-sky-900">
                                    {getFullMcpUrl() || 'Enter base URL first'}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Visual Color
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SERVER_COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setColor(c.value)}
                                            className={`w-10 h-10 rounded-lg transition-all ${
                                                color === c.value
                                                    ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                                                    : 'hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Selected: <span className="font-medium capitalize">{color}</span>
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={(e) => setEnabled(e.target.checked)}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-gray-700">Enabled (auto-connect)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* OAUTH TAB */}
                    {activeSubTab === 'oauth' && (
                        <div>
                            <OAuthTab
                                config={oauthConfig}
                                onConfigChange={handleOAuthConfigChange}
                                serverUrl={getFullMcpUrl()}
                                disabled={false}
                            />
                        </div>
                    )}

                    {/* TESTS TAB */}
                    {activeSubTab === 'tests' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Configure which pre-connection tests to run before connecting to this server.
                            </p>

                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enablePortCheck}
                                        onChange={(e) => setEnablePortCheck(e.target.checked)}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable port connectivity test</span>
                                </label>
                                <div className="text-xs text-gray-600 mt-1 ml-6">
                                    Tests if the server is reachable at the specified URL
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableCorsCheck}
                                        onChange={(e) => setEnableCorsCheck(e.target.checked)}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable CORS configuration test</span>
                                </label>
                                <div className="text-xs text-gray-600 mt-1 ml-6">
                                    Verifies CORS headers allow requests from this origin
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableHealthCheck}
                                        onChange={(e) => setEnableHealthCheck(e.target.checked)}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable health endpoint test</span>
                                </label>
                                <div className="text-xs text-gray-600 mt-1 ml-6">
                                    Tests if /health endpoint responds correctly
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center space-x-2"
                    >
                        <Save className="w-4 h-4" />
                        <span>{server ? 'Save Changes' : 'Add Server'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};