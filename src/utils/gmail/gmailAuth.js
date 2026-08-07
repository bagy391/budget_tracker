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
 * Requires VITE_GOOGLE_CLIENT_ID to be set in environment variables.
 *
 * Returns the access token string, or throws on failure.
 */
export function connectGmail() {
    return new Promise((resolve, reject) => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in Vercel Environment Variables. Please add it and redeploy.'));
            return;
        }

        // Ensure GIS library is loaded
        if (!window.google?.accounts?.oauth2) {
            reject(new Error('Google Identity Services library not loaded. Please refresh the page or check your internet/adblocker.'));
            return;
        }

        try {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: GMAIL_SCOPE,
                error_callback: (err) => {
                    console.error('Google GIS Error:', err);
                    reject(new Error(err.message || 'Google Auth Error: Please add ' + window.location.origin + ' to Authorized JavaScript Origins in Google Cloud Console.'));
                },
                callback: (response) => {
                    if (response.error) {
                        if (response.error === 'popup_closed_by_user') {
                            reject(new Error('Google sign-in popup was closed before completing authorization.'));
                        } else if (response.error === 'access_denied') {
                            reject(new Error('Access denied. Please grant read permission for Gmail alerts.'));
                        } else if (response.error === 'origin_mismatch') {
                            reject(new Error(`Origin Mismatch: Please add ${window.location.origin} to Authorized JavaScript Origins in Google Cloud Console.`));
                        } else {
                            reject(new Error(`Google OAuth error: ${response.error_description || response.error}`));
                        }
                        return;
                    }

                    if (!response.access_token) {
                        reject(new Error('No access token returned from Google.'));
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
        } catch (err) {
            console.error('initTokenClient exception:', err);
            reject(new Error(err.message || 'Failed to initialize Google login.'));
        }
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
