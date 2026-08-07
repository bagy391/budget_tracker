/**
 * Gmail Bank Email Parser Patterns
 * ─────────────────────────────────────────────────────────────────────────────
 * Strict sender email matching & regular expressions for extracting transaction details
 * from official bank alert emails.
 *
 * Official Bank Alert Sender Addresses:
 * 1. Axis Bank (Bank Account)    - alerts@axis.bank.in
 * 2. Axis Bank (Credit Card)     - alerts@axis.bank.in
 * 3. IndusInd / Indie (Account)  - indie.alerts@indusind.com
 * 4. ICICI Bank (Credit Card)    - credit_cards@icici.bank.in
 * 5. HSBC Bank (Credit Card)     - hsbc@mail.hsbc.co.in
 * 6. HDFC Bank (Credit Card)     - alerts@hdfcbank.bank.in
 * 7. YES Bank (Credit Card)      - alerts@yes.bank.in
 */

export const PARSER_PATTERNS = [

    // ════════════════════════════════════════════════════════════
    //  BANK ACCOUNT (DEBIT) TRANSACTIONS
    // ════════════════════════════════════════════════════════════

    // ── Axis Bank (Bank Account Debit) ─────────────────────────────────────
    {
        id: 'axis_bank_account',
        bank: 'Axis Bank',
        senderMatch: /alerts@axis\.bank\.in/i,
        subjectMatch: /debited|A\/c|account/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Amount Debited:|INR|Rs\.?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(?:Date & Time:\s*)?(\d{2}-\d{2}-\d{2,4})/i,
            merchant: /Transaction Info:\s*(?:UPI\/[^\/]+\/[^\/]+\/)?([^\n\r]+)/i,
        }
    },

    // ── IndusInd / Indie Bank (Bank Account Debit) ─────────────────────────
    {
        id: 'indusind_bank',
        bank: 'IndusInd Bank',
        senderMatch: /indie\.alerts@indusind\.com/i,
        paymentType: 'bank',
        patterns: {
            amount: /(?:Bill Amount \([^)]+\):|Rs\.?|INR)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}[-\/]\d{2}[-\/]\d{2,4}|\d{1,2}\s+\w{3},?\s+\d{4})/i,
            merchant: /Biller Name:\s*([^\n\r]+)/i,
        }
    },

    // ════════════════════════════════════════════════════════════
    //  CREDIT CARD TRANSACTIONS
    // ════════════════════════════════════════════════════════════

    // ── Axis Bank (Credit Card Spend) ──────────────────────────────────────
    {
        id: 'axis_credit_card',
        bank: 'Axis Bank',
        senderMatch: /alerts@axis\.bank\.in/i,
        subjectMatch: /spent|credit card/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:Transaction Amount:|INR|Rs\.?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(?:Date & Time:\s*)?(\d{2}-\d{2}-\d{4})/i,
            merchant: /Merchant Name:\s*([^\n\r]+)/i,
        }
    },

    // ── ICICI Bank (Credit Card) ───────────────────────────────────────────
    {
        id: 'icici_credit_card',
        bank: 'ICICI Bank',
        senderMatch: /credit_cards@icici\.bank\.in/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:transaction of|INR|Rs\.?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on\s+(\w{3}\s+\d{1,2},\s*\d{4})/i,
            merchant: /Info:\s*([^.\n\r]+)/i,
        }
    },

    // ── HSBC Bank (Credit Card) ────────────────────────────────────────────
    {
        id: 'hsbc_credit_card',
        bank: 'HSBC Bank',
        senderMatch: /hsbc@mail\.hsbc\.co\.in/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:used for|INR|Rs\.?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /on\s+(\d{1,2}\s+\w{3}\s+\d{4})/i,
            merchant: /payment to\s+([^\n\r]+?)\s+on\s+\d/i,
        }
    },

    // ── HDFC Bank (Credit Card) ────────────────────────────────────────────
    {
        id: 'hdfc_credit_card',
        bank: 'HDFC Bank',
        senderMatch: /alerts@hdfcbank\.bank\.in/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)\s*has been debited/i,
            date:   /on\s+(\d{1,2}\s+\w{3},?\s+\d{4})/i,
            merchant: /towards\s+([^\n\r]+?)\s+on\s+\d/i,
        }
    },

    // ── YES Bank (Credit Card) ─────────────────────────────────────────────
    {
        id: 'yes_bank_credit_card',
        bank: 'YES Bank',
        senderMatch: /alerts@yes\.bank\.in/i,
        paymentType: 'credit_card',
        patterns: {
            amount: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*has been spent/i,
            date:   /on\s+(\d{2}-\d{2}-\d{4})/i,
            merchant: /at\s+([^\n\r]+?)\s+on\s+\d/i,
        }
    },

    // ════════════════════════════════════════════════════════════
    //  UPI / OTHER
    // ════════════════════════════════════════════════════════════

    // ── GPay (Google Pay UPI) ──────────────────────────────────────────────
    {
        id: 'gpay_upi',
        bank: 'Google Pay',
        senderMatch: /googlepay-noreply@google\.com|gpay/i,
        subjectMatch: /paid|payment|upi/i,
        paymentType: 'upi',
        patterns: {
            amount: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\w{3}\s+\d{1,2},?\s*\d{4})/i,
        }
    },

    // ── PhonePe ────────────────────────────────────────────────────────────
    {
        id: 'phonepe_upi',
        bank: 'PhonePe',
        senderMatch: /noreply@phonepe\.com|phonepe/i,
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
        senderMatch: /no-reply@paytm\.com|paytm/i,
        paymentType: 'upi',
        patterns: {
            amount: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
            date:   /(\d{2}[- /]\d{2}[- /]\d{4})/i,
        }
    },

];
