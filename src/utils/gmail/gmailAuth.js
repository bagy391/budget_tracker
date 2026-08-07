/**
 * Gmail OAuth Authentication
 * Uses the Google Identity Services (GIS) library loaded via script tag.
 * Stores the access token + expiry in localStorage (read-only gmail scope).
 */

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY   = 'gmail_access_token';
const EXPIRY_KEY  = 'gmail_token_expiry';

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Open the Google OAuth popup and get an access token.
 * Requires VITE_GOOGLE_CLIENT_ID to be set in .env.local
 *
 * Returns the access token string, or throws on failure.
 */
export function connectGmail() {
    return new Promise((resolve, reject) => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in .env.local'));
            return;
        }

        // Ensure GIS library is loaded
        if (!window.google?.accounts?.oauth2) {
            reject(new Error('Google Identity Services library not loaded'));
            return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPE,
            callback: (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                // Store token + expiry
                const expiry = Date.now() + (response.expires_in * 1000);
                localStorage.setItem(TOKEN_KEY, response.access_token);
                localStorage.setItem(EXPIRY_KEY, String(expiry));
                resolve(response.access_token);
            },
        });

        client.requestAccessToken({ prompt: 'consent' });
    });
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
 * Returns true if Gmail is currently connected with a valid token.
 */
export function isGmailConnected() {
    return getStoredToken() !== null;
}

/**
 * Revoke the stored token and clear local storage.
 */
export function disconnectGmail() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && window.google?.accounts?.oauth2) {
        window.google.accounts.oauth2.revoke(token, () => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
}
