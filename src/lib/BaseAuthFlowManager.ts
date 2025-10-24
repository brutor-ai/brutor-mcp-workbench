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
 * BaseAuthFlowManager - Common OAuth functionality for all flows
 * Proper cleanup of message listeners to prevent stale handlers
 * FIXED: Improved handling of Chrome extension interference
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

        // Wrap the listener to prevent Chrome extension errors from propagating
        const wrappedListener = (event: MessageEvent) => {
            try {
                listener(event);
            } catch (error) {
                // Only log errors that aren't Chrome extension related
                if (error instanceof Error && !error.message.includes('message channel closed')) {
                    console.error('❌ Error in message listener:', error);
                }
            }
        };

        // Register new listener
        this.messageListener = wrappedListener;
        globalListenerRegistry.set(this.serverId, wrappedListener);
        window.addEventListener('message', wrappedListener);

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
            grant_type: this.config.flow,
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

        try {
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
                console.error('❌ Token exchange failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });

                let errorDetail = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.error_description || errorJson.error || errorText;
                } catch {}

                throw new Error(`Token exchange failed: ${response.status} - ${errorDetail}`);
            }

            const tokenData: TokenInfo = await response.json();
            console.log('✅ Token exchange successful for server:', this.serverId);

            return tokenData;

        } catch (error) {
            console.error('❌ Token exchange error:', error);
            throw error;
        }
    }

    // ============================================================================
    // USER INFO EXTRACTION
    // ============================================================================

    protected extractUserInfoFromToken(accessToken: string): UserInfo | null {
        try {
            const decoded = jwtDecode<UserInfo>(accessToken);
            console.log('✅ Decoded user info from access token:', {
                sub: decoded.sub,
                name: decoded.name,
                email: decoded.email
            });
            return decoded;
        } catch (e) {
            console.warn('⚠️ Could not decode access token as JWT (this is normal for opaque tokens)');
            return null;
        }
    }

    // ============================================================================
    // TOKEN VALIDITY
    // ============================================================================

    isAuthenticated(): boolean {
        if (!this.currentToken || !this.tokenExpiryTimestamp) {
            return false;
        }

        // Check if token is expired (with 5 minute buffer)
        const bufferMs = 5 * 60 * 1000; // 5 minutes
        const isValid = Date.now() < (this.tokenExpiryTimestamp - bufferMs);

        if (!isValid) {
            console.log('⚠️ Token expired for server:', this.serverId);
        }

        return isValid;
    }

    getAccessToken(): string | null {
        if (!this.isAuthenticated()) {
            return null;
        }
        return this.currentToken?.access_token || null;
    }

    getIdToken(): string | null {
        return this.currentToken?.id_token || null;
    }

    getUserInfo(): UserInfo | null {
        return this.userInfo;
    }

    getUserRoles(): string[] {
        if (!this.userInfo) return [];

        const roles: string[] = [];

        // Get realm roles
        if (this.userInfo.realm_access?.roles) {
            roles.push(...this.userInfo.realm_access.roles);
        }

        // Get resource/client roles
        if (this.userInfo.resource_access) {
            Object.values(this.userInfo.resource_access).forEach(resource => {
                if (resource.roles) {
                    roles.push(...resource.roles);
                }
            });
        }

        return Array.from(new Set(roles)); // Deduplicate
    }

    hasRole(role: string): boolean {
        return this.getUserRoles().includes(role);
    }

    getUserPermissions(): { canRead: boolean; canWrite: boolean } {
        const roles = this.getUserRoles();

        // Map common role patterns to permissions
        const canWrite = roles.some(role =>
            role.toLowerCase().includes('admin') ||
            role.toLowerCase().includes('write') ||
            role.toLowerCase().includes('edit') ||
            role.toLowerCase().includes('manager')
        );

        const canRead = canWrite || roles.some(role =>
            role.toLowerCase().includes('read') ||
            role.toLowerCase().includes('view') ||
            role.toLowerCase().includes('user')
        );

        return { canRead, canWrite };
    }

    getTokenInfo(): {
        hasToken: boolean;
        expiresIn?: number;
        userInfo?: UserInfo | null;
        permissions?: { canRead: boolean; canWrite: boolean };
        roles?: string[];
        idToken?: string | null;
    } {
        if (!this.isAuthenticated()) {
            return { hasToken: false };
        }

        const expiresIn = this.tokenExpiryTimestamp
            ? Math.max(0, Math.floor((this.tokenExpiryTimestamp - Date.now()) / 1000))
            : undefined;

        return {
            hasToken: true,
            expiresIn,
            userInfo: this.userInfo,
            permissions: this.getUserPermissions(),
            roles: this.getUserRoles(),
            idToken: this.getIdToken()
        };
    }

    // ============================================================================
    // LOGOUT
    // ============================================================================

    logout(performOAuthLogout: boolean = false): void {
        console.log('🚪 Logging out for server:', this.serverId);

        // Clear stored tokens
        this.clearStoredToken();

        // Clear in-memory tokens
        this.currentToken = null;
        this.tokenExpiryTimestamp = null;
        this.userInfo = null;

        // Optionally perform OAuth logout (requires logout endpoint)
        if (performOAuthLogout && this.config.logoutEndpoint && this.currentToken?.id_token) {
            const logoutUrl = new URL(this.config.logoutEndpoint);
            logoutUrl.searchParams.set('id_token_hint', this.currentToken.id_token);
            logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);

            window.location.href = logoutUrl.toString();
        }

        console.log('✅ Logout completed for server:', this.serverId);
    }

    // ============================================================================
    // ABSTRACT METHODS (must be implemented by subclasses)
    // ============================================================================

    abstract startAuthorizationFlow(): Promise<void>;
}