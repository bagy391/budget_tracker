/**
 * Gmail Parser Engine
 * Runs each email through the PARSER_PATTERNS registry and returns a
 * structured ParsedTransaction or null if no pattern matched.
 */

import { PARSER_PATTERNS } from './parserPatterns';

/**
 * Attempt to parse a raw Gmail message into a transaction.
 *
 * @param {object} message - { id, sender, subject, body, date }
 * @returns {ParsedTransaction|null}
 *
 * ParsedTransaction shape:
 * {
 *   messageId   : string   — Gmail message ID (for deduplication)
 *   bank        : string   — matched bank name
 *   paymentType : 'bank' | 'credit_card' | 'upi'
 *   amount      : number   — parsed float
 *   date        : string   — 'YYYY-MM-DD'
 *   rawSnippet  : string   — first 200 chars of body (shown in review UI)
 * }
 */
export function parseEmail(message) {
    const { id, sender = '', subject = '', body = '', date } = message;

    for (const pattern of PARSER_PATTERNS) {
        // 1. Sender must match
        if (!pattern.senderMatch.test(sender)) continue;

        // 2. Subject match (optional)
        if (pattern.subjectMatch && !pattern.subjectMatch.test(subject)) continue;

        // 3. Extract amount (required)
        const amountMatch = body.match(pattern.patterns.amount)
            || subject.match(pattern.patterns.amount);
        if (!amountMatch) continue;

        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) continue;

        // 4. Extract date (optional, fallback to email received date or today)
        let transactionDate = date || new Date().toISOString().split('T')[0];
        if (pattern.patterns.date) {
            const dateMatch = body.match(pattern.patterns.date)
                || subject.match(pattern.patterns.date);
            if (dateMatch) {
                const parsed = tryParseDate(dateMatch[1]);
                if (parsed) transactionDate = parsed;
            }
        }

        return {
            messageId:   id,
            bank:        pattern.bank,
            paymentType: pattern.paymentType,
            amount,
            date:        transactionDate,
            rawSnippet:  body.replace(/\s+/g, ' ').trim().slice(0, 200),
        };
    }

    return null; // no pattern matched
}

/**
 * Parse multiple messages and return only the ones that matched.
 */
export function parseEmails(messages) {
    const results = [];
    for (const msg of messages) {
        const parsed = parseEmail(msg);
        if (parsed) results.push(parsed);
    }
    return results;
}

// ── Date parsing helpers ────────────────────────────────────────────────────

const MONTH_MAP = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function tryParseDate(str) {
    if (!str) return null;
    str = str.trim();

    // DD-Mon-YYYY or DD/Mon/YYYY  e.g. "05-Aug-2026"
    const dmy = str.match(/(\d{1,2})[- /](\w{3,})[- /](\d{4})/);
    if (dmy) {
        const mon = MONTH_MAP[dmy[2].slice(0, 3).toLowerCase()];
        if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, '0')}`;
    }

    // DD/MM/YYYY
    const numeric = str.match(/(\d{2})[/ -](\d{2})[/ -](\d{4})/);
    if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;

    // Mon DD, YYYY  e.g. "Aug 5, 2026"
    const mdy = str.match(/(\w{3,})\s+(\d{1,2}),?\s*(\d{4})/);
    if (mdy) {
        const mon = MONTH_MAP[mdy[1].slice(0, 3).toLowerCase()];
        if (mon) return `${mdy[3]}-${mon}-${mdy[2].padStart(2, '0')}`;
    }

    return null;
}
