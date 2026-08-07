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
 * Trigger Google OAuth popup synchronously in response to user click.
 *
 * @param {function} onSuccess - Callback when token is acquired (receives token string)
 * @param {function} onError   - Callback when error occurs (receives Error object)
 */
export function connectGmail(onSuccess, onError) {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
        const err = new Error('VITE_GOOGLE_CLIENT_ID is not set in Vercel Environment Variables. Please add it in Vercel Project Settings and redeploy.');
        if (onError) onError(err);
        return;
    }

    // Ensure GIS library is loaded
    if (!window.google?.accounts?.oauth2) {
        const err = new Error('Google Identity Services library not loaded. Please refresh the page or check your internet/adblocker.');
        if (onError) onError(err);
        return;
    }

    try {
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPE,
            error_callback: (err) => {
                console.error('Google GIS Error:', err);
                if (onError) onError(new Error(err.message || `Google Auth Error: Please add ${window.location.origin} to Authorized JavaScript Origins in Google Cloud Console.`));
            },
            callback: (response) => {
                console.log('Google OAuth callback response:', response);

                // 1. If access_token is present, authorization succeeded!
                if (response && response.access_token) {
                    const expiry = Date.now() + (response.expires_in * 1000);
                    localStorage.setItem(TOKEN_KEY, response.access_token);
                    localStorage.setItem(EXPIRY_KEY, String(expiry));
                    if (onSuccess) onSuccess(response.access_token);
                    return;
                }

                // 2. Only if access_token is missing, handle error
                if (response && response.error) {
                    let msg = `Google OAuth error: ${response.error}`;
                    if (response.error === 'popup_closed_by_user') {
                        msg = 'Sign-in popup closed before authorization was completed.';
                    } else if (response.error === 'access_denied') {
                        msg = 'Access denied. Permission to read Gmail was not granted.';
                    } else if (response.error === 'origin_mismatch') {
                        msg = `Origin Mismatch: Please add ${window.location.origin} to Authorized JavaScript Origins in Google Cloud Console.`;
                    }
                    if (onError) onError(new Error(msg));
                    return;
                }

                if (onError) onError(new Error('No access token returned from Google.'));
            },
        });

        // Must be called synchronously inside user click event to prevent browser popup blockers from auto-closing
        client.requestAccessToken();
    } catch (err) {
        console.error('initTokenClient exception:', err);
        if (onError) onError(new Error(err.message || 'Failed to initialize Google login.'));
    }
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
