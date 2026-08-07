/**
 * Gmail API Client
 * Fetches and decodes messages from the Gmail REST API.
 * Uses the access token from gmailAuth.js.
 */

import { getStoredToken } from './gmailAuth';
import { supabase }       from '../supabaseClient';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ── Deduplication via Supabase ──────────────────────────────────────────────

async function getProcessedIds(userId) {
    const { data } = await supabase
        .from('gmail_processed')
        .select('message_id')
        .eq('user_id', userId);
    return new Set((data || []).map(r => r.message_id));
}

export async function markProcessed(userId, messageIds) {
    if (!messageIds.length) return;
    await supabase.from('gmail_processed').upsert(
        messageIds.map(id => ({ user_id: userId, message_id: id })),
        { onConflict: 'user_id,message_id' }
    );
}

// ── Core fetch helpers ──────────────────────────────────────────────────────

async function gmailFetch(path, params = {}) {
    const token = getStoredToken();
    if (!token) throw new Error('Gmail not connected');

    const url = new URL(`${GMAIL_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail API error ${res.status}`);
    }
    return res.json();
}

// Decode base64url-encoded email body
function decodeBase64(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    try {
        return decodeURIComponent(
            atob(b64)
                .split('')
                .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
        );
    } catch {
        return atob(b64);
    }
}

function extractBody(payload) {
    if (!payload) return '';

    // Plain body
    if (payload.body?.data) return decodeBase64(payload.body.data);

    // Multipart — prefer text/plain
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64(part.body.data);
            }
        }
        // Fallback to first part with data
        for (const part of payload.parts) {
            if (part.body?.data) return decodeBase64(part.body.data);
        }
    }
    return '';
}

function getHeader(headers, name) {
    return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch and decode Gmail messages from the last `daysBack` days.
 * Automatically skips already-processed message IDs.
 *
 * @param {string} userId  - Supabase user ID
 * @param {number} daysBack - How many days back to search (default 10)
 * @returns {Array<{id, sender, subject, body, date}>}
 */
export async function fetchNewMessages(userId, daysBack = 10) {
    const after = Math.floor((Date.now() - daysBack * 86400 * 1000) / 1000);

    // Fetch message list
    const listData = await gmailFetch('/messages', {
        q: `after:${after} (debit OR credit OR debited OR credited OR paid OR payment OR transaction OR alert)`,
        maxResults: 100,
    });

    if (!listData.messages?.length) return [];

    // Filter out already-processed
    const processedIds = await getProcessedIds(userId);
    const newMessages  = listData.messages.filter(m => !processedIds.has(m.id));

    if (!newMessages.length) return [];

    // Fetch full message details in parallel (batches of 10)
    const results = [];
    for (let i = 0; i < newMessages.length; i += 10) {
        const batch = newMessages.slice(i, i + 10);
        const fetched = await Promise.all(
            batch.map(m => gmailFetch(`/messages/${m.id}`, { format: 'full' }))
        );
        results.push(...fetched);
    }

    // Decode each message
    return results.map(msg => {
        const headers = msg.payload?.headers || [];
        const dateStr = getHeader(headers, 'date');
        let date = new Date().toISOString().split('T')[0];
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d)) date = d.toISOString().split('T')[0];
        }
        return {
            id:      msg.id,
            sender:  getHeader(headers, 'from'),
            subject: getHeader(headers, 'subject'),
            body:    extractBody(msg.payload),
            date,
        };
    });
}
