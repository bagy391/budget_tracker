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

    let htmlBody = '';

    function walk(part) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
            return decodeBase64(part.body.data);
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody = decodeBase64(part.body.data);
        }
        if (part.parts) {
            for (const subPart of part.parts) {
                const res = walk(subPart);
                if (res) return res;
            }
        }
        return null;
    }

    const plainText = walk(payload);
    if (plainText) return plainText;

    // Fallback: convert HTML to text by stripping tags & entities
    if (htmlBody) {
        return htmlBody
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ');
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
export async function fetchNewMessages(userId, daysBack = 1) {
    // Format date as YYYY/MM/DD for Gmail API after: query
    const d = new Date(Date.now() - daysBack * 86400 * 1000);
    const afterDateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

    // Fetch all bank emails by searching for bank names in from/subject/body
    const listData = await gmailFetch('/messages', {
        q: `after:${afterDateStr} (from:indie.alerts@indusind.com OR from:alerts@axis.bank.in OR from:credit_cards@icici.bank.in OR from:hsbc@mail.hsbc.co.in OR from:alerts@hdfcbank.bank.in OR from:alerts@yes.bank.in OR from:googlepay-noreply@google.com OR from:noreply@phonepe.com OR from:no-reply@paytm.com)`,
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
        let date = new Date().toISOString();
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d)) date = d.toISOString();
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
