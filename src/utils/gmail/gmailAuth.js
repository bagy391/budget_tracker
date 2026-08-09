/**
 * Gmail OAuth Authentication
 * Uses the Google Identity Services (GIS) library loaded via script tag.
 * Stores the access token + expiry in localStorage (read-only gmail scope).
 * Includes detailed diagnostic logging for debugging deployment environments.
 */

const GMAIL_SCOPE    = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY      = 'gmail_access_token';
const EXPIRY_KEY     = 'gmail_token_expiry';
const CONNECTED_KEY  = 'gmail_user_connected';

// Diagnostic logger array
if (typeof window !== 'undefined') {
    window._gmailAuthLogs = window._gmailAuthLogs || [];
}

function logDiag(msg, data = null) {
    const entry = { time: new Date().toLocaleTimeString(), msg, data };
    console.log(`[GmailAuth Diag] ${msg}`, data || '');
    if (typeof window !== 'undefined') {
        window._gmailAuthLogs = [entry, ...(window._gmailAuthLogs || []).slice(0, 49)];
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Connect to Google OAuth.
 *
 * @param {function} onSuccess - Callback when token is acquired
 * @param {function} onError   - Callback on error
 * @param {object}   options   - { prompt: 'consent' | '' }
 */
export function connectGmail(onSuccess, onError, options = {}) {
    let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
        clientId = clientId.trim().replace(/^[\s\t]+|[\s\t]+$/g, '');
    }

    const isSilent = options.prompt === '';

    logDiag(`Initiating connectGmail (${isSilent ? 'Silent' : 'Interactive'})`, {
        clientIdConfigured: Boolean(clientId),
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        gisLoaded: typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2),
    });

    if (!clientId) {
        const err = new Error('VITE_GOOGLE_CLIENT_ID is missing in build environment.');
        logDiag('ERROR: Client ID missing');
        if (onError) onError(err);
        return;
    }

    if (!window.google?.accounts?.oauth2) {
        const err = new Error('Google Identity Services library not loaded. Please refresh the page.');
        logDiag('ERROR: GIS script not loaded');
        if (onError) onError(err);
        return;
    }

    try {
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPE,
            error_callback: (err) => {
                logDiag('GIS error_callback fired', err);
                if (isSilent) {
                    // Silent refresh failed, reset connected state
                    localStorage.removeItem(CONNECTED_KEY);
                }
                if (onError) onError(new Error(err.message || 'Google Auth Error'));
            },
            callback: (response) => {
                logDiag('GIS callback fired', response);

                if (response && response.access_token) {
                    const expiry = Date.now() + (response.expires_in * 1000);
                    localStorage.setItem(TOKEN_KEY, response.access_token);
                    localStorage.setItem(EXPIRY_KEY, String(expiry));
                    localStorage.setItem(CONNECTED_KEY, 'true');

                    logDiag('SUCCESS: Token acquired & saved', {
                        expiresInSeconds: response.expires_in,
                        tokenPrefix: response.access_token.slice(0, 10) + '...',
                    });

                    if (onSuccess) onSuccess(response.access_token);
                    return;
                }

                if (response && response.error) {
                    if (isSilent) {
                        localStorage.removeItem(CONNECTED_KEY);
                    }
                    let msg = `Google OAuth error: ${response.error}`;
                    if (response.error === 'popup_closed_by_user') {
                        msg = 'Sign-in popup closed before authorization was completed.';
                    } else if (response.error === 'access_denied') {
                        msg = 'Access denied. Permission to read Gmail was not granted.';
                    }
                    logDiag('ERROR in GIS callback', { error: response.error });
                    if (onError) onError(new Error(msg));
                    return;
                }

                if (onError) onError(new Error('No access token returned from Google.'));
            },
        });

        logDiag(`Calling requestAccessToken(prompt: "${options.prompt || 'consent'}")`);
        client.requestAccessToken(options.prompt !== undefined ? { prompt: options.prompt } : {});
    } catch (err) {
        logDiag('EXCEPTIONAL ERROR in connectGmail', err);
        if (onError) onError(new Error(err.message || 'Failed to initialize Google login.'));
    }
}

/**
 * Ensures a valid token exists. If expired but user previously connected,
 * automatically performs a silent token refresh without showing a popup.
 */
export function ensureValidToken() {
    return new Promise((resolve, reject) => {
        const token = getStoredToken();
        if (token) {
            resolve(token);
            return;
        }

        const wasConnected = localStorage.getItem(CONNECTED_KEY) === 'true';
        if (!wasConnected) {
            reject(new Error('Gmail not connected. Please click Connect Gmail.'));
            return;
        }

        logDiag('Token expired/missing, attempting silent auto-refresh...');
        connectGmail(
            (freshToken) => resolve(freshToken),
            (err) => {
                logDiag('Silent auto-refresh failed', err.message);
                reject(new Error('Session expired. Please reconnect Gmail.'));
            },
            { prompt: '' } // silent refresh
        );
    });
}

/**
 * Get stored diagnostic logs for on-screen UI debugging.
 */
export function getDiagLogs() {
    return typeof window !== 'undefined' ? window._gmailAuthLogs || [] : [];
}

/**
 * Get the stored access token if valid, otherwise return null.
 */
export function getStoredToken() {
    const token  = localStorage.getItem(TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
    if (!token || Date.now() >= expiry) return null;
    return token;
}

/**
 * Returns true if Gmail is currently connected or marked as connected.
 */
export function isGmailConnected() {
    return getStoredToken() !== null || localStorage.getItem(CONNECTED_KEY) === 'true';
}

/**
 * Revoke the stored token and clear connection state.
 */
export function disconnectGmail() {
    logDiag('Disconnecting Gmail and revoking token');
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && window.google?.accounts?.oauth2) {
        window.google.accounts.oauth2.revoke(token, () => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(CONNECTED_KEY);
}
