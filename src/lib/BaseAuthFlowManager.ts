/*
 * Copyright 2025 Martin Bergljung
 *
 * BaseAuthFlowManager - Common OAuth functionality for all flows
 * FIXED: Proper cleanup of message listeners to prevent stale handlers
 */

import { jwtDecode } from 'jwt-decode';
import { OAuthConfig } from '../types';

export interface TokenInfo {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
    refresh_token?: string;
}

export interface UserInfo {
    sub: string;
    email?: string;
    name?: string;
    preferred_username?: string;
    login?: string;
    id?: number;
    avatar_url?: string;
    type?: string;
    realm_access?: {
        roles: string[];
    };
    resource_access?: {
        [clientId: string]: {
            roles: string[];
        };
    };
}

// CRITICAL: Global registry to track active listeners per server
const globalListenerRegistry = new Map<string, (event: MessageEvent) => void>();

export abstract class BaseAuthFlowManager {
    protected config: OAuthConfig;
    protected onLogEntry?: (entry: any) => void;
    protected currentToken: TokenInfo | null = null;
    protected tokenExpiryTimestamp: number | null = null;
    protected userInfo: UserInfo | null = null;
    protected serverId: string;
    protected oauthPopup: Window | null = null;
    protected messageListener: ((event: MessageEvent) => void) | null = null;

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void, serverId?: string) {
        this.config = config;
        this.onLogEntry = onLogEntry;
        this.serverId = serverId || 'default';

        // CRITICAL: Clean up any existing listener for this server before creating new one
        this.cleanupGlobalListener();

        // Try to restore token from sessionStorage
        this.restoreTokenFromStorage();
    }

    // ============================================================================
    // GLOBAL LISTENER CLEANUP
    // ============================================================================

    /**
     * Clean up any existing message listener for this server from global registry
     * This prevents stale listeners from previous instances
     */
    private cleanupGlobalListener(): void {
        const existingListener = globalListenerRegistry.get(this.serverId);
        if (existingListener) {
            console.log('🧹 Removing stale message listener for server:', this.serverId);
            window.removeEventListener('message', existingListener);
            globalListenerRegistry.delete(this.serverId);
        }
    }

    /**
     * Register the current message listener in global registry
     */
    protected registerMessageListener(listener: (event: MessageEvent) => void): void {
        // Clean up any existing listener first
        this.cleanupGlobalListener();

        // Register new listener
        this.messageListener = listener;
        globalListenerRegistry.set(this.serverId, listener);
        window.addEventListener('message', listener);

        console.log('✅ Registered new message listener for server:', this.serverId);
    }

    // ============================================================================
    // STORAGE HELPERS (common for all flows)
    // ============================================================================

    protected getStorageKey(key: string): string {
        return `oauth_${this.serverId}_${key}`;
    }

    protected setSessionItem(key: string, value: string): void {
        sessionStorage.setItem(this.getStorageKey(key), value);
    }

    protected getSessionItem(key: string): string | null {
        return sessionStorage.getItem(this.getStorageKey(key));
    }

    protected removeSessionItem(key: string): void {
        sessionStorage.removeItem(this.getStorageKey(key));
    }

    // ============================================================================
    // TOKEN PERSISTENCE (common for all flows)
    // ============================================================================

    private restoreTokenFromStorage(): void {
        const tokenStr = this.getSessionItem('token');
        const expiryStr = this.getSessionItem('token_expiry');
        const userInfoStr = this.getSessionItem('user_info');

        if (tokenStr && expiryStr) {
            try {
                this.currentToken = JSON.parse(tokenStr);
                this.tokenExpiryTimestamp = parseInt(expiryStr);

                if (userInfoStr) {
                    this.userInfo = JSON.parse(userInfoStr);
                }

                console.log('🔄 Restored token from storage for server:', this.serverId);
            } catch (e) {
                console.error('❌ Failed to restore token:', e);
                this.clearStoredToken();
            }
        }
    }

    protected persistToken(token: TokenInfo, userInfo: UserInfo | null): void {
        try {
            this.currentToken = token;
            this.tokenExpiryTimestamp = Date.now() + (token.expires_in * 1000);
            this.userInfo = userInfo;

            this.setSessionItem('token', JSON.stringify(token));
            this.setSessionItem('token_expiry', String(this.tokenExpiryTimestamp));

            if (userInfo) {
                this.setSessionItem('user_info', JSON.stringify(userInfo));
            }

            console.log('💾 Persisted token to storage for server:', this.serverId);
        } catch (e) {
            console.error('❌ Failed to persist token:', e);
        }
    }

    protected clearStoredToken(): void {
        this.removeSessionItem('token');
        this.removeSessionItem('token_expiry');
        this.removeSessionItem('user_info');
    }

    // ============================================================================
    // POPUP MANAGEMENT (common for all flows)
    // ============================================================================

    protected openOAuthPopup(url: string): Window | null {
        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            url,
            'oauth-popup',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        if (popup) {
            popup.focus();
            console.log('✅ OAuth popup opened for server:', this.serverId);
        } else {
            console.error('❌ Failed to open OAuth popup');
        }

        return popup;
    }

    protected cleanup(): void {
        // Remove from global registry
        this.cleanupGlobalListener();

        // Close popup if still open
        if (this.oauthPopup && !this.oauthPopup.closed) {
            this.oauthPopup.close();
        }
        this.oauthPopup = null;
        this.messageListener = null;

        console.log('🧹 OAuth popup cleanup completed for server:', this.serverId);
    }

    // ============================================================================
    // TOKEN EXCHANGE (common implementation, can be overridden)
    // ============================================================================

    protected async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<TokenInfo> {
        if (!this.config.tokenEndpoint) {
            throw new Error('Token endpoint is required');
        }

        console.log('🔄 Exchanging authorization code for tokens...', {
            serverId: this.serverId,
            tokenEndpoint: this.config.tokenEndpoint,
            hasCodeVerifier: !!codeVerifier
        });

        const requestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            code: code,
            redirect_uri: window.location.origin + '/callback'
        });

        // Add client secret if available (for traditional auth code flow)
        if (this.config.clientSecret) {
            requestBody.append('client_secret', this.config.clientSecret);
        }

        // Add code verifier if provided (for PKCE flow)
        if (codeVerifier) {
            requestBody.append('code_verifier', codeVerifier);
        }

        const response = await fetch(this.config.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetail = errorText;

            try {
                const errorJson = JSON.parse(errorText);
                errorDetail = errorJson.error_description || errorJson.error || errorText;
            } catch {
                // Use raw text if not JSON
            }

            console.error('❌ Token exchange failed:', {
                serverId: this.serverId,
                status: response.status,
                error: errorDetail
            });

            throw new Error(`Token exchange failed: ${response.status} - ${errorDetail}`);
        }

        // Handle both JSON and form-encoded responses (GitHub uses form-encoded)
        const contentType = response.headers.get('content-type');
        let tokenData: TokenInfo;

        if (contentType?.includes('application/x-www-form-urlencoded')) {
            const text = await response.text();
            const params = new URLSearchParams(text);
            tokenData = {
                access_token: params.get('access_token')!,
                token_type: params.get('token_type') || 'bearer',
                expires_in: parseInt(params.get('expires_in') || '3600'),
                scope: params.get('scope') || undefined,
                refresh_token: params.get('refresh_token') || undefined
            };
        } else {
            tokenData = await response.json();
        }

        // Validate we got an access token
        if (!tokenData.access_token) {
            throw new Error('No access token received from authorization server');
        }

        // Default expires_in if not provided (common with GitHub)
        if (!tokenData.expires_in) {
            tokenData.expires_in = 3600;
        }

        console.log('✅ Token exchange successful for server:', this.serverId);

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'success',
                operation: 'oauth-token-exchange',
                details: {
                    flow: this.config.flow,
                    serverId: this.serverId
                }
            });
        }

        return tokenData;
    }

    // ============================================================================
    // USER INFO EXTRACTION (common for all flows)
    // ============================================================================

    protected extractUserInfoFromToken(token: string): UserInfo | null {
        try {
            const decoded = jwtDecode<UserInfo>(token);
            console.log('✅ User info decoded from token:', {
                serverId: this.serverId,
                sub: decoded.sub,
                email: decoded.email,
                name: decoded.name
            });
            return decoded;
        } catch (e) {
            console.warn('⚠️ Could not decode user info from token (normal for some providers):', e);
            return null;
        }
    }

    // ============================================================================
    // TOKEN VALIDATION (common for all flows)
    // ============================================================================

    isAuthenticated(): boolean {
        const hasToken = this.currentToken !== null;
        const tokenExpired = this.isTokenExpired();
        const result = hasToken && !tokenExpired;

        console.log(`${this.constructor.name}.isAuthenticated:`, {
            serverId: this.serverId,
            hasToken,
            tokenExpired,
            result
        });

        return result;
    }

    protected isTokenExpired(): boolean {
        if (!this.currentToken || !this.tokenExpiryTimestamp) return true;

        // Add a 30-second buffer for network latency
        const buffer = 30000;
        return Date.now() >= (this.tokenExpiryTimestamp - buffer);
    }

    // ============================================================================
    // TOKEN ACCESS (common for all flows)
    // ============================================================================

    getAccessToken(): string | null {
        if (!this.isAuthenticated()) return null;
        return this.currentToken?.access_token || null;
    }

    getUserInfo(): UserInfo | null {
        return this.userInfo;
    }

    getTokenInfo(): {
        hasToken: boolean;
        expiresIn?: number;
        roles?: string[];
        permissions?: any;
        userInfo?: UserInfo;
        idToken?: string;
    } {
        if (!this.currentToken) {
            return { hasToken: false };
        }

        const expiresIn = this.tokenExpiryTimestamp
            ? Math.max(0, Math.floor((this.tokenExpiryTimestamp - Date.now()) / 1000))
            : undefined;

        return {
            hasToken: true,
            expiresIn,
            roles: this.getUserRoles(),
            permissions: this.getUserPermissions(),
            userInfo: this.userInfo,
            idToken: this.currentToken.id_token
        };
    }

    // ============================================================================
    // PERMISSIONS & ROLES (can be overridden by subclasses)
    // ============================================================================

    getUserRoles(): string[] {
        if (!this.userInfo) return [];

        const roles: string[] = [];

        // Add realm roles (Keycloak)
        if (this.userInfo.realm_access?.roles) {
            roles.push(...this.userInfo.realm_access.roles);
        }

        // Add client-specific roles (Keycloak)
        if (this.userInfo.resource_access?.[this.config.clientId]?.roles) {
            roles.push(...this.userInfo.resource_access[this.config.clientId].roles);
        }

        return roles;
    }

    getUserPermissions(): { canRead: boolean; canWrite: boolean } {
        if (!this.isAuthenticated() || !this.currentToken) {
            return { canRead: false, canWrite: false };
        }

        const roles = this.getUserRoles();
        const scopes = this.currentToken.scope?.split(/[\s,]+/) || [];

        // Check roles (Keycloak-style)
        const hasReadRole = roles.includes('todo:read') || roles.includes('todo:write');
        const hasWriteRole = roles.includes('todo:write');

        // Check scopes (GitHub-style)
        const hasReadScope = scopes.includes('repo') || scopes.includes('public_repo') || scopes.includes('user');
        const hasWriteScope = scopes.includes('repo');

        return {
            canRead: hasReadRole || hasReadScope,
            canWrite: hasWriteRole || hasWriteScope
        };
    }

    hasRole(role: string): boolean {
        return this.getUserRoles().includes(role);
    }

    // ============================================================================
    // LOGOUT (common for all flows)
    // ============================================================================

    logout(performIdPLogout: boolean = false): void {
        console.log('🧹 Logout called for server:', this.serverId);

        // Clear local state
        this.currentToken = null;
        this.userInfo = null;
        this.tokenExpiryTimestamp = null;

        // Clear stored tokens
        this.clearStoredToken();
        this.removeSessionItem('state');
        this.removeSessionItem('code_verifier');

        // Cleanup any popup and listeners
        this.cleanup();

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'success',
                operation: 'oauth-logout',
                details: {
                    flow: this.config.flow,
                    serverId: this.serverId
                }
            });
        }

        // IdP logout if requested
        if (performIdPLogout && this.config.logoutEndpoint) {
            this.performIdPLogout();
        }
    }

    private performIdPLogout(): void {
        if (!this.config.logoutEndpoint) return;

        try {
            const logoutUrl = new URL(this.config.logoutEndpoint);

            // Add post_logout_redirect_uri
            if (this.config.postLogoutRedirectUri) {
                logoutUrl.searchParams.set('post_logout_redirect_uri', this.config.postLogoutRedirectUri);
            } else {
                logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
            }

            // Add id_token_hint if available
            if (this.currentToken?.id_token) {
                logoutUrl.searchParams.set('id_token_hint', this.currentToken.id_token);
            } else {
                // For public clients without id_token, use client_id
                logoutUrl.searchParams.set('client_id', this.config.clientId);
            }

            console.log('🔄 Redirecting to IdP logout:', logoutUrl.toString());

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-idp-logout',
                    details: {
                        serverId: this.serverId
                    }
                });
            }

            window.location.href = logoutUrl.toString();
        } catch (error) {
            console.error('❌ Failed to perform IdP logout:', error);
            window.location.reload();
        }
    }

    // ============================================================================
    // STATE RESET (for cleanup/recovery)
    // ============================================================================

    resetState(): void {
        this.removeSessionItem('state');
        this.removeSessionItem('code_verifier');
        this.cleanup();
        console.log('🧹 State reset for server:', this.serverId);
    }

    // ============================================================================
    // ABSTRACT METHODS (must be implemented by subclasses)
    // ============================================================================

    abstract startAuthorizationFlow(): Promise<void>;
    abstract handleAuthorizationCallback(): Promise<TokenInfo>;
}