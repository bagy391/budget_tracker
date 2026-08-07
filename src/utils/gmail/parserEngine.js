/**
 * Gmail Parser Engine
 * Runs each email through the PARSER_PATTERNS registry and returns a
 * structured ParsedTransaction or null if no pattern matched.
 * Strictly filters out credit/refund transactions and marketing/promo junk.
 */

import { PARSER_PATTERNS } from './parserPatterns.js';

/**
 * Attempt to parse a raw Gmail message into a transaction.
 *
 * @param {object} message - { id, sender, subject, body, date }
 * @param {boolean} debug  - if true, returns debug info even on no-match
 * @returns {ParsedTransaction|DebugResult|null}
 */
export function parseEmail(message, debug = false) {
    const { id, sender = '', subject = '', body = '', date } = message;

    // Normalise whitespace in body for matching
    const normBody = body.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
    const fullText = subject + ' ' + normBody;

    const debugLog = [];

    for (const pattern of PARSER_PATTERNS) {
        const senderOk  = pattern.senderMatch.test(sender);
        const subjectOk = !pattern.subjectMatch || pattern.subjectMatch.test(subject);

        if (debug) {
            debugLog.push({
                patternId:   pattern.id,
                bank:        pattern.bank,
                senderOk,
                subjectOk,
                senderTried: sender,
                subjectTried: subject,
            });
        }

        if (!senderOk)  continue;
        if (!subjectOk) continue;

        const currentLog = debugLog[debugLog.length - 1];

        // 1. Skip Promotional / Loan offer marketing emails
        const isLoanOrPromoOffer = /\b(?:borrow up to|pre-approved loan|preapproved loan|easy monthly repayments|quick approval|instant loan approval|apply for personal loan)\b/i.test(fullText);
        if (isLoanOrPromoOffer) {
            if (debug) currentLog.failReason = 'Loan / Marketing promo ignored';
            continue;
        }

        // 2. Skip Credit / Refund transactions (only debits / spends allowed)
        const isExplicitCredit =
            /\b(?:credited|refund|refunded|reversal|reversed|cashback|credit alert)\b/i.test(subject) ||
            /(?:amount credited|has been credited|credited to|credited with|refund of|cashback of|reversal of)/i.test(normBody);
        const hasDebitKeyword =
            /\b(?:debited|spent|used for|paid|payment done|processed successfully|purchase|bill)\b/i.test(fullText);

        if (isExplicitCredit && !hasDebitKeyword) {
            if (debug) currentLog.failReason = 'Credit/Refund transaction ignored (only debits allowed)';
            continue;
        }

        // 3. Extract amount
        const amountMatch = normBody.match(pattern.patterns.amount)
            || subject.match(pattern.patterns.amount);

        if (!amountMatch) {
            if (debug) currentLog.failReason = 'amount not found';
            continue;
        }

        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
            if (debug) currentLog.failReason = 'amount invalid';
            continue;
        }

        // 4. Extract date
        let transactionDate = date || new Date().toISOString().split('T')[0];
        if (pattern.patterns.date) {
            const dateMatch = normBody.match(pattern.patterns.date)
                || subject.match(pattern.patterns.date);
            if (dateMatch) {
                const parsed = tryParseDate(dateMatch[1]);
                if (parsed) transactionDate = parsed;
            }
        }

        // 5. Extract merchant / description
        let description = '';
        if (pattern.patterns.merchant) {
            const merchMatch = normBody.match(pattern.patterns.merchant)
                || subject.match(pattern.patterns.merchant);
            if (merchMatch && merchMatch[1]) {
                let rawMerch = merchMatch[1].trim();
                rawMerch = rawMerch.replace(/[.,;:]+$/, '').trim();
                if (rawMerch.includes('UPI/')) {
                    const parts = rawMerch.split('/');
                    rawMerch = parts[parts.length - 1].trim();
                }
                description = rawMerch;
            }
        }

        return {
            messageId:   id,
            bank:        pattern.bank,
            paymentType: pattern.paymentType,
            amount,
            date:        transactionDate,
            description,
            rawSnippet:  normBody.trim().slice(0, 200),
            _debug:      debug ? debugLog : undefined,
        };
    }

    return debug
        ? { messageId: id, sender, subject, matched: false, debugLog }
        : null;
}

/**
 * Parse multiple messages. Returns { matched, unmatched } arrays.
 * Pass debug=true to get failure reasons for unmatched emails.
 */
export function parseEmails(messages, debug = false) {
    const matched   = [];
    const unmatched = [];
    for (const msg of messages) {
        const result = parseEmail(msg, debug);
        if (!result)                    { unmatched.push({ messageId: msg.id, sender: msg.sender, subject: msg.subject, debugLog: [] }); }
        else if (result.matched === false) { unmatched.push(result); }
        else                            { matched.push(result); }
    }
    return debug ? { matched, unmatched } : { matched, unmatched: [] };
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
    const dmy_mon = str.match(/(\d{1,2})[- /](\w{3,})[- /](\d{4})/);
    if (dmy_mon) {
        const mon = MONTH_MAP[dmy_mon[2].slice(0, 3).toLowerCase()];
        if (mon) return `${dmy_mon[3]}-${mon}-${dmy_mon[1].padStart(2, '0')}`;
    }

    // DD Mon YYYY or DD Mon, YYYY  e.g. "14 Jul, 2026" or "02 Aug 2026"
    const dmy_str = str.match(/(\d{1,2})\s+(\w{3,}),?\s+(\d{4})/);
    if (dmy_str) {
        const mon = MONTH_MAP[dmy_str[2].slice(0, 3).toLowerCase()];
        if (mon) return `${dmy_str[3]}-${mon}-${dmy_str[1].padStart(2, '0')}`;
    }

    // Mon DD, YYYY  e.g. "Aug 07, 2026"
    const mdy = str.match(/(\w{3,})\s+(\d{1,2}),?\s*(\d{4})/);
    if (mdy) {
        const mon = MONTH_MAP[mdy[1].slice(0, 3).toLowerCase()];
        if (mon) return `${mdy[3]}-${mon}-${mdy[2].padStart(2, '0')}`;
    }

    // DD-MM-YYYY or DD/MM/YYYY  e.g. "07-08-2026"
    const dmy_num = str.match(/(\d{2})[- /](\d{2})[- /](\d{4})/);
    if (dmy_num) return `${dmy_num[3]}-${dmy_num[2]}-${dmy_num[1]}`;

    // DD-MM-YY  e.g. "04-08-26"
    const dmy_short = str.match(/(\d{2})[- /](\d{2})[- /](\d{2})$/);
    if (dmy_short) return `20${dmy_short[3]}-${dmy_short[2]}-${dmy_short[1]}`;

    return null;
}
