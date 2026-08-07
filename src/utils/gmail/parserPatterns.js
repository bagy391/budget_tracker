/**
 * Gmail Bank Email Parser Patterns
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW BANK:
 *
 *  1. Find a sample email from that bank (sender address + body text).
 *  2. Add a new object to the PARSER_PATTERNS array below.
 *  3. Fill in the required fields: id, bank, senderMatch, patterns.amount
 *  4. Test with a real email body string using parseEmail() from parserEngine.js
 *
 * PATTERN OBJECT SHAPE:
 * {
 *   id            : string   — unique ID, e.g. 'hdfc_debit'
 *   bank          : string   — display name shown in UI
 *   senderMatch   : RegExp   — matched against the sender email address
 *   subjectMatch  : RegExp?  — optional, matched against subject line
 *   paymentType   : 'bank' | 'credit_card' | 'upi'  — pre-fills payment method
 *   patterns: {
 *     amount      : RegExp   — capture group 1 must be the numeric amount string
 *     date        : RegExp?  — capture group 1 = date string (fallback: today)
 *   }
 * }
 */

export const PARSER_PATTERNS = [

    // ── HDFC Bank ──────────────────────────────────────────────────────────
    {
        id: 'hdfc_debit',
        bank: 'HDFC Bank',
        senderMatch: /hdfcbank/i,
        subjectMatch: /alert|transaction|debited/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{1,2}[- /]\w+[- /]\d{2,4})/i,
        }
    },
    {
        id: 'hdfc_credit_card',
        bank: 'HDFC Credit Card',
        senderMatch: /hdfcbank/i,
        subjectMatch: /credit card|cc alert/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{1,2}[- /]\w+[- /]\d{2,4})/i,
        }
    },

    // ── ICICI Bank ─────────────────────────────────────────────────────────
    {
        id: 'icici_debit',
        bank: 'ICICI Bank',
        senderMatch: /icicibank|alerts@icici/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{2}-\w{3}-\d{4})/i,
        }
    },
    {
        id: 'icici_credit_card',
        bank: 'ICICI Credit Card',
        senderMatch: /icicibank/i,
        subjectMatch: /credit card/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{2}-\w{3}-\d{4})/i,
        }
    },

    // ── SBI ────────────────────────────────────────────────────────────────
    {
        id: 'sbi_debit',
        bank: 'SBI',
        senderMatch: /sbi\.co\.in|sbibank/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}\/\d{2}\/\d{4})/i,
        }
    },

    // ── Axis Bank ──────────────────────────────────────────────────────────
    {
        id: 'axis_debit',
        bank: 'Axis Bank',
        senderMatch: /axisbank/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{2}[- /]\d{2}[- /]\d{4})/i,
        }
    },
    {
        id: 'axis_credit_card',
        bank: 'Axis Credit Card',
        senderMatch: /axisbank/i,
        subjectMatch: /credit card/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on (\d{2}[- /]\d{2}[- /]\d{4})/i,
        }
    },

    // ── Kotak Mahindra Bank ────────────────────────────────────────────────
    {
        id: 'kotak_debit',
        bank: 'Kotak Bank',
        senderMatch: /kotak/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}-\w{3}-\d{4})/i,
        }
    },

    // ── YES Bank ───────────────────────────────────────────────────────────
    {
        id: 'yes_bank_debit',
        bank: 'YES Bank',
        senderMatch: /yesbank/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}[- /]\d{2}[- /]\d{4})/i,
        }
    },

    // ── GPay (Google Pay UPI) ──────────────────────────────────────────────
    {
        id: 'gpay_upi',
        bank: 'Google Pay',
        senderMatch: /google|gpay/i,
        subjectMatch: /paid|payment|upi/i,
        paymentType: 'upi',
        patterns: {
            amount: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\w{3} \d{1,2},?\s*\d{4})/i,
        }
    },

    // ── PhonePe ────────────────────────────────────────────────────────────
    {
        id: 'phonepe_upi',
        bank: 'PhonePe',
        senderMatch: /phonepe/i,
        paymentType: 'upi',
        patterns: {
            amount: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{1,2}\s+\w+\s+\d{4})/i,
        }
    },

    // ── Paytm ──────────────────────────────────────────────────────────────
    {
        id: 'paytm_upi',
        bank: 'Paytm',
        senderMatch: /paytm/i,
        paymentType: 'upi',
        patterns: {
            amount: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}[- /]\d{2}[- /]\d{4})/i,
        }
    },

];
