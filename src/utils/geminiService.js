import { buildPromptContextString } from './aiDataPrep.js';
import { formatCurrency } from './calculations.js';
import { FINANCIAL_TOOLS } from './aiTools.js';
import { executeFinancialTool } from './aiToolExecutor.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash'
];

/**
 * Retrieve the active Gemini API key.
 * Checks user-specific localStorage, fallback localStorage, and Vite environment variables.
 */
export const getGeminiApiKey = (userId = null) => {
    if (typeof localStorage !== 'undefined') {
        if (userId) {
            const userKey = localStorage.getItem(`gemini_api_key_${userId}`);
            if (userKey && userKey.trim()) return userKey.trim();
        }
        const globalKey = localStorage.getItem('gemini_api_key');
        if (globalKey && globalKey.trim()) return globalKey.trim();
    }

    try {
        const envKey = import.meta?.env?.VITE_GEMINI_API_KEY;
        if (envKey && envKey.trim()) return envKey.trim();
    } catch {}

    return '';
};

/**
 * Save Gemini API Key to localStorage.
 */
export const setGeminiApiKey = (key, userId = null) => {
    if (typeof localStorage === 'undefined') return;
    const trimmed = (key || '').trim();
    if (userId) {
        if (trimmed) {
            localStorage.setItem(`gemini_api_key_${userId}`, trimmed);
        } else {
            localStorage.removeItem(`gemini_api_key_${userId}`);
        }
    }
    if (trimmed) {
        localStorage.setItem('gemini_api_key', trimmed);
    } else {
        localStorage.removeItem('gemini_api_key');
    }
};

/**
 * Get preferred Gemini model.
 */
export const getGeminiModel = () => {
    if (typeof localStorage === 'undefined') return DEFAULT_MODEL;
    const saved = localStorage.getItem('gemini_model_preference');
    if (!saved || saved.includes('1.5') || saved.includes('2.0') || saved.includes('2.5') || saved === 'gemini-3.8-flash' || saved === 'gemini-flash-latest') {
        return DEFAULT_MODEL;
    }
    return saved;
};

/**
 * Set preferred Gemini model.
 */
export const setGeminiModel = (model) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('gemini_model_preference', model || DEFAULT_MODEL);
};

/**
 * Test Gemini API connection.
 */
export const testGeminiConnection = async (apiKey, model = DEFAULT_MODEL) => {
    if (!apiKey) {
        return { success: false, error: 'API key is required.' };
    }

    const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)];

    for (const m of modelsToTry) {
        try {
            const response = await fetch(`${GEMINI_API_BASE}/${m}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: 'Hello! Respond with: "Gemini connection active."' }]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 20
                    }
                })
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                const message = errJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

                if (response.status === 404 || response.status === 429 || response.status === 503 || message.toLowerCase().includes('not found') || message.toLowerCase().includes('quota')) {
                    continue;
                }

                return { success: false, error: message };
            }

            const data = await response.json();
            const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            setGeminiModel(m);
            return { success: true, message: reply.trim(), workingModel: m };
        } catch (err) {
            return { success: false, error: err.message || 'Network connection failed.' };
        }
    }

    return { success: false, error: 'Could not connect to any available Gemini models with this API key.' };
};

/**
 * Parse special follow-up suggestions generated at the end of the response.
 */
const parseResponseAndSuggestions = (rawText) => {
    if (!rawText) return { replyText: '', suggestedQuestions: [] };

    const marker = '---SUGGESTED_QUESTIONS---';
    if (!rawText.includes(marker)) {
        return { replyText: rawText.trim(), suggestedQuestions: [] };
    }

    const parts = rawText.split(marker);
    const replyText = parts[0].trim();
    const suggestionsRaw = parts[1] || '';

    const suggestedQuestions = suggestionsRaw
        .split('\n')
        .map(line => line.trim().replace(/^[*•\-]\s*/, ''))
        .filter(line => line.length > 5 && line.length < 90)
        .slice(0, 3);

    return { replyText, suggestedQuestions };
};

/**
 * Ask Google Gemini Financial Advisor with Optimized Dynamic Tool Calling.
 * Strict 1-to-2 call guarantee to protect quota and eliminate cascading loops.
 */
export const askGeminiAdvisor = async ({
    question,
    financialContext = {},
    toolContext = {},
    conversationHistory = [],
    scope = 'personal',
    userId = null,
    model = null,
    onStatusUpdate = null
}) => {
    const apiKey = getGeminiApiKey(userId);
    if (!apiKey) {
        throw new Error('MISSING_API_KEY');
    }

    const activeModel = model || getGeminiModel();
    const currentDateStr = new Date().toISOString().split('T')[0];

    // Combine tool context with live wealth assets and family cashflow
    const fullToolContext = {
        ...toolContext,
        scope,
        currentFamily: toolContext.currentFamily || financialContext.currentFamily,
        currentUser: toolContext.currentUser || financialContext.currentUser,
        wealthAssets: toolContext.wealthAssets || financialContext.wealthAssets || []
    };

    // Fast-path snapshot of current month so simple questions require 0 tool calls
    const incomeSourcesStr = financialContext?.totals?.incomeSources?.length > 0
        ? ` (Sources: ${financialContext.totals.incomeSources.map(s => `${s.source}: ${formatCurrency(s.total)}`).join(', ')})`
        : '';

    const budgetSnapshotStr = financialContext?.overallBudget?.limit > 0
        ? `- Monthly Budget: ${formatCurrency(financialContext.overallBudget.limit)} (${formatCurrency(financialContext.overallBudget.spent)} spent / ${financialContext.overallBudget.percentUsed}% used, Forecast: ${formatCurrency(financialContext.totals.projectedMonthEndSpend)}${financialContext.overallBudget.projectedOver ? ` ⚠️ PROJECTED TO EXCEED BUDGET BY ${formatCurrency(financialContext.overallBudget.projectedDiff)}` : ' — On Track'})\n`
        : '';

    const activeWealth = financialContext?.wealth?.active;
    const wealthSnapshotStr = activeWealth
        ? `\nWEALTH & INVESTMENT PORTFOLIO (${activeWealth.label}):
- Net Worth / Current Value: ${formatCurrency(activeWealth.totalNetWorth)}
- Total Invested Capital: ${formatCurrency(activeWealth.totalInvested)}
- Unrealized Gains / Returns: ${formatCurrency(activeWealth.totalGains)} (${activeWealth.roi >= 0 ? '+' : ''}${activeWealth.roi}% ROI across ${activeWealth.assetCount} assets)
- Asset Allocations: ${activeWealth.allocation.map(a => `${a.type.toUpperCase()}: ${formatCurrency(a.totalCurrent)} (${a.percentOfPortfolio}%, Gains: ${formatCurrency(a.gains)})`).join(', ') || 'No assets recorded'}
- Comparison Summary: Personal Net Worth is ${formatCurrency(financialContext.wealth?.my?.totalNetWorth || 0)} (${financialContext.wealth?.my?.assetCount || 0} assets) vs Total Family Net Worth is ${formatCurrency(financialContext.wealth?.family?.totalNetWorth || 0)} (${financialContext.wealth?.family?.assetCount || 0} assets)\n`
        : '';

    const currentSnapshot = financialContext?.totals
        ? `\nHOUSEHOLD CASHFLOW & BUDGET SNAPSHOT (${financialContext.currentMonthLabel}):
(Note: All incomes and expenses are unified family-wide across the whole household.)
${budgetSnapshotStr}- Total Household Income: ${formatCurrency(financialContext.totals.income)}${incomeSourcesStr}
- Previous Month Household Income: ${formatCurrency(financialContext.totals.prevIncome)}
- Total Household Expense: ${formatCurrency(financialContext.totals.expense)} (Previous month: ${formatCurrency(financialContext.totals.prevExpense)})
- Net Household Savings: ${formatCurrency(financialContext.totals.netSavings)} (${financialContext.totals.savingsRate}% savings rate)
- Top Household Spending Categories: ${financialContext.categoryAnalysis?.slice(0, 6).map(c => `${c.name}: ${formatCurrency(c.currentSpend)}`).join(', ') || 'None recorded'}
${wealthSnapshotStr}
(If the user asks about the current month cashflow, income sources, budgets, or active wealth overview, answer immediately using this snapshot without calling tools! Only call tools for older historical dates, specific merchants, deep searches, or detailed asset portfolio holdings.)\n`
        : '';

    const systemInstructionText = `
You are an intelligent, empathetic, and sharp AI Financial Advisor and Wealth Strategist embedded in a personal finance & budget tracker app.
Current Reference Date: ${currentDateStr} (Year: ${new Date().getFullYear()}).

CORE DOMAIN SEPARATION RULES:
1. CASHFLOW & BUDGETING (INCOMES & EXPENSES): All expenses, incomes, and budgets are ALWAYS unified family-wide across the entire household. There is no personal vs family separation for cashflow; every member's salary (including June's ₹3,21,245 and all other months) and spending are part of one unified household ledger.
2. WEALTH PORTFOLIO ANALYSIS (PERSONAL VS FAMILY): Wealth portfolio analysis has two dedicated scopes:
   - Active Wealth Mode: ${scope === 'personal' ? 'PERSONAL WEALTH (Focused on assets owned directly by the user, isOwner=true)' : 'FAMILY WEALTH (Focused on the combined household portfolio across all family members)'}.
   - You can analyze asset allocation, mutual funds, stocks, EPF, NPS, FDs, bank accounts, net worth, invested capital, unrealized gains, and ROI.
   - If the user asks to compare personal wealth vs family wealth, analyze both transparently using the snapshot or the "getWealthPortfolio" tool.
${currentSnapshot}
CAPABILITIES & TOOLS:
You have tools to query financial and wealth data:
1. "getWealthPortfolio": Retrieve deep wealth portfolio metrics, net worth, invested totals, gains, ROI %, asset class allocation (mutual_fund, stock, epf, nps, bank, fd), and individual asset holdings. Supports scope ('personal' or 'family') and optional assetType filter. ALWAYS invoke this tool if the user asks for detailed asset lists, specific investment holdings, or portfolio breakdown.
2. "getIncomeBreakdown": Retrieve REAL monthly income breakdown, total income, income sources (Salary, Freelance, etc.), and recent income entries for ANY date range or past year across the family. ALWAYS call this tool whenever the user asks about income history, salary, earnings, or monthly income.
3. "searchTransactions": Search individual expense and income transactions across ANY date range by keyword (e.g. Swiggy, Salary, Amazon, Bonus), category, or amount.
4. "getSpendingSummary": Calculate total income, expense, net savings, category breakdown, AND monthly breakdown for ANY custom time interval.
5. "compareSpendingPeriods": Compare two distinct date ranges (e.g. this month vs last month, or July 2024 vs July 2025).
6. "getBudgetStatus": Check active category budgets and spending limits.
7. "getRecurringSubscriptions": List recurring subscriptions and regular bills.

CRITICAL ACCURACY & INTEGRITY RULES:
1. NEVER INVENT OR HALLUCINATE NUMBERS. Every single figure, table cell, or asset amount you present MUST come directly from the snapshot or from tool execution results.
2. Incomes and expenses are family-wide; never state that a family member's income is missing if it is recorded in the ledger.
3. If asked for monthly income breakdown, invoke "getIncomeBreakdown". Present ONLY the real monthly numbers returned by the tool. If a month has no income entries in the database, report it as ₹0 or state that no income was recorded for that month. NEVER invent numbers to fill gaps or fabricate a timeline!
4. If you need data not in the snapshot, invoke AT MOST ONE tool.
5. All monetary amounts must be formatted in Indian Rupees (₹) (e.g. ₹4,500).
6. Be concise, mathematically accurate, and format with Markdown (tables, bullet points, bold text).
7. At the very end of your final response, ALWAYS append 2 or 3 relevant follow-up questions formatted EXACTLY like this:
---SUGGESTED_QUESTIONS---
* <short question 1>
* <short question 2>
* <short question 3>
`.trim();

    // Format conversation history for Gemini API
    const contents = [];
    const recentHistory = conversationHistory.slice(-4);
    recentHistory.forEach(msg => {
        contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    });

    contents.push({
        role: 'user',
        parts: [{ text: question }]
    });

    const modelsToTry = [activeModel, ...FALLBACK_MODELS.filter(m => m !== activeModel)];
    let lastError = null;

    for (const m of modelsToTry) {
        try {
            const currentContents = [...contents];

            // CALL 1: Ask Gemini (Decides between direct text or 1 tool call)
            const requestBody1 = {
                system_instruction: { parts: [{ text: systemInstructionText }] },
                contents: currentContents,
                tools: FINANCIAL_TOOLS,
                generationConfig: {
                    temperature: 0.25,
                    maxOutputTokens: 2048
                }
            };

            const response1 = await fetch(`${GEMINI_API_BASE}/${m}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody1)
            });

            if (!response1.ok) {
                const errJson = await response1.json().catch(() => ({}));
                const errMsg = errJson?.error?.message || `HTTP ${response1.status}`;

                if (response1.status === 400 && errMsg.toLowerCase().includes('api_key')) {
                    throw new Error('INVALID_API_KEY');
                } else if (response1.status === 429 || response1.status === 503 || response1.status === 404) {
                    lastError = new Error(errMsg);
                    continue; // Try next model
                } else {
                    throw new Error(errMsg);
                }
            }

            const data1 = await response1.json();
            const part1 = data1?.candidates?.[0]?.content?.parts?.[0];

            if (!part1) {
                continue;
            }

            // Case A: Gemini requested a tool call (Call 2 needed for synthesis)
            if (part1.functionCall) {
                const { name, args } = part1.functionCall;
                onStatusUpdate?.(`Querying ${name}...`);

                const toolResult = await executeFinancialTool(name, args || {}, fullToolContext);

                currentContents.push({ role: 'model', parts: [part1] });
                currentContents.push({
                    role: 'user',
                    parts: [{ functionResponse: { name, response: toolResult } }]
                });

                onStatusUpdate?.('Analyzing results...');

                // CALL 2: Final synthesis WITHOUT tools parameter so it answers immediately!
                const requestBody2 = {
                    system_instruction: {
                        parts: [{
                            text: systemInstructionText + '\nYou have received the requested tool data. Now synthesize your final clear answer for the user directly in Markdown. Do not call any further tools.'
                        }]
                    },
                    contents: currentContents,
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                };

                const response2 = await fetch(`${GEMINI_API_BASE}/${m}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody2)
                });

                if (!response2.ok) {
                    const errJson = await response2.json().catch(() => ({}));
                    throw new Error(errJson?.error?.message || `HTTP ${response2.status}`);
                }

                const data2 = await response2.json();
                const part2 = data2?.candidates?.[0]?.content?.parts?.[0];
                const replyRaw = part2?.text || 'Here is the summary of your requested data.';
                const { replyText, suggestedQuestions } = parseResponseAndSuggestions(replyRaw);

                setGeminiModel(m);
                return {
                    replyText,
                    suggestedQuestions,
                    model: m
                };
            }

            // Case B: Gemini answered directly in Call 1 (0 tool calls needed)
            if (part1.text) {
                const { replyText, suggestedQuestions } = parseResponseAndSuggestions(part1.text);
                setGeminiModel(m);
                return {
                    replyText,
                    suggestedQuestions,
                    model: m
                };
            }
        } catch (error) {
            if (error.message === 'INVALID_API_KEY') {
                throw error;
            }
            lastError = error;
        }
    }

    throw lastError || new Error('Rate limit or quota reached on all models. Please try again in a few moments.');
};

/**
 * Generate heuristic + pre-computed spending trend highlights.
 * Works even offline or while waiting for initial API calls.
 */
export const calculateTrendCards = (financialContext) => {
    const { totals, categoryAnalysis, topExpenses } = financialContext;

    // 1. Velocity Surge Card
    let velocityCard = {
        title: 'Spending Velocity',
        status: 'neutral',
        icon: 'TrendingUp',
        headline: 'Spending is on track',
        description: `Average daily spend is ${formatCurrency(totals.dailyAverageSpend)}/day.`
    };

    const surgingCategory = categoryAnalysis.find(c => c.momChange !== null && c.momChange > 20 && c.currentSpend > 500);
    const droppingCategory = categoryAnalysis.find(c => c.momChange !== null && c.momChange < -15 && c.prevSpend > 500);

    if (surgingCategory) {
        velocityCard = {
            title: 'Spending Velocity',
            status: 'warning',
            icon: 'Flame',
            headline: `${surgingCategory.name} up ${surgingCategory.momChange}% MoM`,
            description: `You've spent ${formatCurrency(surgingCategory.currentSpend)} this month, up from ${formatCurrency(surgingCategory.prevSpend)} last month.`
        };
    } else if (droppingCategory) {
        velocityCard = {
            title: 'Spending Velocity',
            status: 'success',
            icon: 'TrendingDown',
            headline: `${droppingCategory.name} decreased by ${Math.abs(droppingCategory.momChange)}%`,
            description: `Great discipline! Spending in ${droppingCategory.name} dropped compared to last month.`
        };
    }

    // 2. Budget Health Card
    let budgetCard = {
        title: 'Budget Health',
        status: 'success',
        icon: 'Shield',
        headline: 'Within Safe Limits',
        description: `Projected month-end spend is ${formatCurrency(totals.projectedMonthEndSpend)}.`
    };

    const overallBudget = financialContext?.overallBudget;

    if (overallBudget && overallBudget.limit > 0) {
        if (overallBudget.isOverBudget) {
            const overAmt = overallBudget.spent - overallBudget.limit;
            budgetCard = {
                title: 'Budget Alert',
                status: 'error',
                icon: 'AlertCircle',
                headline: `Over Budget by ${formatCurrency(overAmt)}`,
                description: `You've spent ${formatCurrency(overallBudget.spent)} of your ${formatCurrency(overallBudget.limit)} budget (${overallBudget.percentUsed}% used).`
            };
        } else if (overallBudget.projectedOver) {
            budgetCard = {
                title: 'Budget Warning',
                status: 'error',
                icon: 'Flame',
                headline: `Projected ${formatCurrency(overallBudget.projectedDiff)} Over Budget`,
                description: `At ${formatCurrency(totals.dailyAverageSpend)}/day, forecast is ${formatCurrency(totals.projectedMonthEndSpend)} vs your ${formatCurrency(overallBudget.limit)} limit.`
            };
        } else {
            const buffer = overallBudget.limit - totals.projectedMonthEndSpend;
            budgetCard = {
                title: 'Budget Health',
                status: 'success',
                icon: 'Shield',
                headline: `On Track for ${formatCurrency(overallBudget.limit)} Budget`,
                description: `Projected spend is ${formatCurrency(totals.projectedMonthEndSpend)} (${formatCurrency(buffer)} safety buffer remaining).`
            };
        }
    } else {
        const overBudgetCats = categoryAnalysis.filter(c => c.isOverBudget);
        if (overBudgetCats.length > 0) {
            budgetCard = {
                title: 'Budget Alert',
                status: 'error',
                icon: 'AlertCircle',
                headline: `${overBudgetCats.length} category over limit`,
                description: `${overBudgetCats.map(c => c.name).join(', ')} exceeded budget limits.`
            };
        } else if (totals.expenseChangePercent && parseFloat(totals.expenseChangePercent) > 25) {
            budgetCard = {
                title: 'Pace Warning',
                status: 'warning',
                icon: 'AlertCircle',
                headline: `Spending pace up ${totals.expenseChangePercent}%`,
                description: `Current burn rate is faster than last month.`
            };
        } else {
            budgetCard = {
                title: 'Budget Health',
                status: 'neutral',
                icon: 'Shield',
                headline: 'No Monthly Limit Set',
                description: `Projected month-end spend is ${formatCurrency(totals.projectedMonthEndSpend)}.`
            };
        }
    }

    // 3. Savings Rate Card
    const savingsRateNum = parseFloat(totals.savingsRate) || 0;
    let savingsCard = {
        title: 'Net Savings Rate',
        status: savingsRateNum >= 20 ? 'success' : savingsRateNum >= 0 ? 'warning' : 'error',
        icon: 'Wallet',
        headline: `${totals.savingsRate}% Savings Rate`,
        description: `Net saved: ${formatCurrency(totals.netSavings)} out of ${formatCurrency(totals.income)} income.`
    };

    // 4. Wealth Portfolio Card
    const activeWealth = financialContext?.wealth?.active;
    let wealthCard = null;
    if (activeWealth && (activeWealth.totalNetWorth > 0 || activeWealth.assetCount > 0)) {
        const isGain = activeWealth.totalGains >= 0;
        wealthCard = {
            title: activeWealth.label,
            status: isGain ? 'success' : 'warning',
            icon: 'Gem',
            headline: `${formatCurrency(activeWealth.totalNetWorth)} Net Worth`,
            description: `Invested: ${formatCurrency(activeWealth.totalInvested)} • Gains: ${formatCurrency(activeWealth.totalGains)} (${activeWealth.roi >= 0 ? '+' : ''}${activeWealth.roi}% ROI across ${activeWealth.assetCount} assets).`
        };
    }

    // 5. Smart Tip
    const largestExpenseTitle = topExpenses.length > 0 ? (topExpenses[0].title || topExpenses[0].description) : null;
    let tipCard = {
        title: 'AI Smart Tip',
        status: 'info',
        icon: 'Lightbulb',
        headline: largestExpenseTitle ? `High Spend: ${largestExpenseTitle}` : 'Track Daily Expenses',
        description: topExpenses.length > 0
            ? `Your largest single purchase this month was ${formatCurrency(topExpenses[0].amount)} for "${largestExpenseTitle}".`
            : 'Track daily expenses regularly to keep your monthly forecast accurate.'
    };

    return [budgetCard, wealthCard, savingsCard, velocityCard, tipCard].filter(Boolean);
};
