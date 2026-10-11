import {
    parseISO,
    isWithinInterval,
    endOfDay,
    startOfDay,
    format,
    startOfMonth,
    endOfMonth,
    eachMonthOfInterval
} from 'date-fns';

/**
 * Safely parse any date representation (ISO, standard Date string, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD).
 */
export const parseDateSafe = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
    const str = String(dateVal).trim();
    if (!str) return null;

    // 1. Try standard parseISO
    try {
        const d = parseISO(str);
        if (!isNaN(d.getTime())) return d;
    } catch {}

    // 2. Try native new Date()
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
    } catch {}

    // 3. Try DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmy) {
        try {
            const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
            if (!isNaN(d.getTime())) return d;
        } catch {}
    }

    // 4. Try YYYY/MM/DD
    const ymd = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (ymd) {
        try {
            const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
            if (!isNaN(d.getTime())) return d;
        } catch {}
    }

    return null;
};

/**
 * Executes a tool function call requested by the Gemini LLM.
 *
 * @param {string} toolName - Name of the function to execute
 * @param {Object} args - Arguments passed by Gemini
 * @param {Object} context - Financial data and auth state
 * @returns {Promise<Object>} Execution result to pass back to Gemini
 */
export const executeFinancialTool = async (toolName, args = {}, context = {}) => {
    const {
        expenses = [],
        incomes = [],
        budgets = [],
        categories = [],
        wealthAssets = [],
        currentUser = null,
        currentFamily = null,
        scope: defaultScope = 'personal'
    } = context;

    const activeScope = args.scope || defaultScope;

    // Expenses & Incomes are ALWAYS Family-wide (Household cashflow)
    const scopedExpenses = expenses;
    const scopedIncomes = incomes;

    switch (toolName) {
        case 'getWealthPortfolio': {
            const { scope: requestedScope, assetType = 'all' } = args;
            const targetScope = requestedScope || activeScope || 'personal';

            const myAssets = wealthAssets.filter(a => a.isOwner);
            const sharedAssets = wealthAssets.filter(a => !a.isOwner);
            const familyAssets = [...myAssets, ...sharedAssets];

            let assets = targetScope === 'family' ? familyAssets : myAssets;

            if (assetType && assetType !== 'all') {
                assets = assets.filter(a => (a.asset_type || '').toLowerCase() === assetType.toLowerCase());
            }

            const totalCurrent = assets.reduce((sum, a) => sum + (parseFloat(a.current_amount) || 0), 0);
            const totalInvested = assets
                .filter(a => a.asset_type !== 'bank')
                .reduce((sum, a) => sum + (parseFloat(a.invested_amount) || 0), 0);
            const totalGains = totalCurrent - totalInvested;
            const roi = totalInvested > 0 ? parseFloat(((totalGains / totalInvested) * 100).toFixed(2)) : 0;

            const byType = {};
            assets.forEach(a => {
                const t = a.asset_type || 'other';
                if (!byType[t]) {
                    byType[t] = { type: t, totalCurrent: 0, totalInvested: 0, count: 0 };
                }
                byType[t].totalCurrent += (parseFloat(a.current_amount) || 0);
                if (t !== 'bank') {
                    byType[t].totalInvested += (parseFloat(a.invested_amount) || 0);
                }
                byType[t].count += 1;
            });

            const allocation = Object.values(byType).map(item => ({
                type: item.type,
                totalCurrent: Math.round(item.totalCurrent),
                totalInvested: Math.round(item.totalInvested),
                gains: Math.round(item.totalCurrent - item.totalInvested),
                percentOfPortfolio: totalCurrent > 0 ? parseFloat(((item.totalCurrent / totalCurrent) * 100).toFixed(1)) : 0,
                count: item.count
            })).sort((a, b) => b.totalCurrent - a.totalCurrent);

            const assetList = assets.map(a => ({
                id: a.id,
                name: a.asset_name,
                type: a.asset_type,
                invested: parseFloat(a.invested_amount) || 0,
                current: parseFloat(a.current_amount) || 0,
                gains: Math.round((parseFloat(a.current_amount) || 0) - (parseFloat(a.invested_amount) || 0)),
                roi: parseFloat(a.invested_amount) > 0
                    ? parseFloat(((((parseFloat(a.current_amount) || 0) - parseFloat(a.invested_amount)) / parseFloat(a.invested_amount)) * 100).toFixed(1))
                    : 0,
                isOwner: !!a.isOwner,
                maturityDate: a.maturity_date || null
            })).sort((a, b) => b.current - a.current);

            return {
                scope: targetScope,
                portfolioLabel: targetScope === 'family' ? 'Joint Family Wealth Portfolio' : 'Personal Wealth Portfolio',
                totalNetWorth: Math.round(totalCurrent),
                totalInvested: Math.round(totalInvested),
                totalGains: Math.round(totalGains),
                overallROI: roi,
                assetCount: assets.length,
                currency: 'INR',
                allocation,
                assets: assetList
            };
        }

        case 'getIncomeBreakdown': {
            const {
                startDate,
                endDate,
                source
            } = args;

            let results = [...scopedIncomes];

            let start = startDate ? parseDateSafe(startDate) : null;
            let end = endDate ? parseDateSafe(endDate) : null;

            if (start) start = startOfDay(start);
            if (end) end = endOfDay(end);

            if (start || end) {
                results = results.filter(i => {
                    if (!i.date) return false;
                    const d = parseDateSafe(i.date);
                    if (!d) return false;
                    if (start && d < start) return false;
                    if (end && d > end) return false;
                    return true;
                });
            }

            if (source && source.trim()) {
                const sLower = source.toLowerCase().trim();
                if (sLower !== 'all' && sLower !== 'income' && sLower !== 'incomes') {
                    results = results.filter(i => (i.source || '').toLowerCase().includes(sLower));
                }
            }

            // Calculate total income
            const totalIncome = results.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

            // Group by month
            const monthlyMap = {};
            results.forEach(i => {
                if (!i.date) return;
                const d = parseDateSafe(i.date);
                if (!d) return;

                const monthKey = format(d, 'yyyy-MM');
                const monthLabel = format(d, 'MMMM yyyy');
                if (!monthlyMap[monthKey]) {
                    monthlyMap[monthKey] = {
                        month: monthKey,
                        monthLabel,
                        totalIncome: 0,
                        count: 0,
                        sources: {}
                    };
                }
                const amt = parseFloat(i.amount) || 0;
                monthlyMap[monthKey].totalIncome += amt;
                monthlyMap[monthKey].count += 1;
                const src = i.source || 'Income';
                monthlyMap[monthKey].sources[src] = (monthlyMap[monthKey].sources[src] || 0) + amt;
            });

            if (typeof console !== 'undefined') {
                console.log('[AI Tool Executor] getIncomeBreakdown debug:', {
                    allIncomesInDbCount: incomes.length,
                    scopedIncomesCount: scopedIncomes.length,
                    matchedResultsCount: results.length,
                    monthsFound: Object.keys(monthlyMap),
                    allIncomesSummary: incomes.map(i => ({ date: i.date, source: i.source, amount: i.amount, user_id: i.user_id }))
                });
            }

            // Convert to sorted monthly array (chronological)
            const monthlyBreakdown = Object.keys(monthlyMap)
                .sort()
                .map(mKey => {
                    const m = monthlyMap[mKey];
                    return {
                        month: m.month,
                        monthLabel: m.monthLabel,
                        totalIncome: Math.round(m.totalIncome),
                        count: m.count,
                        sources: Object.entries(m.sources).map(([sName, sAmt]) => ({
                            source: sName,
                            amount: Math.round(sAmt)
                        }))
                    };
                });

            // Group by source across all results
            const sourceMap = {};
            results.forEach(i => {
                const s = i.source || 'Income';
                sourceMap[s] = (sourceMap[s] || 0) + (parseFloat(i.amount) || 0);
            });

            const sourceBreakdown = Object.entries(sourceMap)
                .map(([sName, sTotal]) => ({
                    source: sName,
                    total: Math.round(sTotal),
                    percent: totalIncome > 0 ? parseFloat(((sTotal / totalIncome) * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => b.total - a.total);

            const activeMonthCount = monthlyBreakdown.length || 1;
            const averageMonthlyIncome = Math.round(totalIncome / activeMonthCount);

            const trimmedIncomes = results.slice(0, 50).map(i => ({
                date: i.date,
                source: i.source || 'Income',
                amount: parseFloat(i.amount) || 0,
                spender: i.profiles?.full_name || 'Member'
            }));

            return {
                scopeUsed: activeScope,
                totalIncome: Math.round(totalIncome),
                totalCount: results.length,
                averageMonthlyIncome,
                currency: 'INR',
                monthlyBreakdown,
                sourceBreakdown,
                recentIncomes: trimmedIncomes
            };
        }

        case 'searchTransactions': {
            const {
                query = '',
                startDate,
                endDate,
                category,
                minAmount,
                maxAmount,
                type = 'all',
                limit = 50
            } = args;

            let items = [];

            if (type === 'expense' || type === 'all') {
                scopedExpenses.forEach(e => {
                    items.push({
                        type: 'expense',
                        date: e.transaction_date,
                        title: e.title || e.description || 'Expense',
                        description: e.description || '',
                        category: e.categories?.name || 'Uncategorized',
                        amount: parseFloat(e.amount) || 0,
                        notes: e.notes || '',
                        paymentMethod: e.payment_methods?.name || 'N/A',
                        spender: e.profiles?.full_name || 'Member'
                    });
                });
            }

            if (type === 'income' || type === 'all') {
                scopedIncomes.forEach(i => {
                    items.push({
                        type: 'income',
                        date: i.date,
                        title: i.source || 'Income',
                        description: i.description || i.source || 'Income',
                        category: 'Income',
                        amount: parseFloat(i.amount) || 0,
                        notes: i.description || '',
                        paymentMethod: 'N/A',
                        spender: i.profiles?.full_name || 'Member'
                    });
                });
            }

            // Date filtering
            if (startDate || endDate) {
                items = items.filter(item => {
                    if (!item.date) return false;
                    try {
                        const date = parseISO(item.date);
                        if (startDate && date < startOfDay(parseISO(startDate))) return false;
                        if (endDate && date > endOfDay(parseISO(endDate))) return false;
                        return true;
                    } catch {
                        return false;
                    }
                });
            }

            // Keyword query filtering (in title, description, notes, category)
            if (query && query.trim()) {
                const qLower = query.toLowerCase().trim();
                items = items.filter(item => {
                    const title = (item.title || '').toLowerCase();
                    const desc = (item.description || '').toLowerCase();
                    const notes = (item.notes || '').toLowerCase();
                    const catName = (item.category || '').toLowerCase();
                    return title.includes(qLower) || desc.includes(qLower) || notes.includes(qLower) || catName.includes(qLower);
                });
            }

            // Category filtering
            if (category && category.trim()) {
                const catLower = category.toLowerCase().trim();
                items = items.filter(item => {
                    const name = (item.category || '').toLowerCase();
                    return name.includes(catLower);
                });
            }

            // Amount filtering
            if (minAmount !== undefined && minAmount !== null) {
                items = items.filter(item => item.amount >= parseFloat(minAmount));
            }
            if (maxAmount !== undefined && maxAmount !== null) {
                items = items.filter(item => item.amount <= parseFloat(maxAmount));
            }

            // Sort by date descending
            items.sort((a, b) => {
                try {
                    return parseISO(b.date) - parseISO(a.date);
                } catch {
                    return 0;
                }
            });

            const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
            const totalCount = items.length;

            const trimmedTransactions = items.slice(0, Math.min(limit, 100));

            return {
                matchedCount: totalCount,
                totalAmountSum: Math.round(totalAmount * 100) / 100,
                currency: 'INR',
                scopeUsed: activeScope,
                transactions: trimmedTransactions
            };
        }

        case 'getSpendingSummary': {
            const { startDate, endDate, category } = args;
            if (!startDate || !endDate) {
                return { error: 'Both startDate and endDate are required.' };
            }

            const start = startOfDay(parseISO(startDate));
            const end = endOfDay(parseISO(endDate));

            let periodExpenses = scopedExpenses.filter(e => {
                if (!e.transaction_date) return false;
                try {
                    const d = parseISO(e.transaction_date);
                    return isWithinInterval(d, { start, end });
                } catch {
                    return false;
                }
            });

            if (category && category.trim()) {
                const cLower = category.toLowerCase().trim();
                periodExpenses = periodExpenses.filter(e => (e.categories?.name || '').toLowerCase().includes(cLower));
            }

            const periodIncomes = scopedIncomes.filter(i => {
                if (!i.date) return false;
                try {
                    const d = parseISO(i.date);
                    return isWithinInterval(d, { start, end });
                } catch {
                    return false;
                }
            });

            const totalExpense = periodExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const totalIncome = periodIncomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
            const netSavings = totalIncome - totalExpense;

            // Monthly Breakdown between start and end
            let monthlyBreakdown = [];
            try {
                const monthsList = eachMonthOfInterval({ start, end });
                monthlyBreakdown = monthsList.map(m => {
                    const mStart = startOfMonth(m);
                    const mEnd = endOfMonth(m);
                    const mExpenses = periodExpenses.filter(e => {
                        try {
                            const d = parseISO(e.transaction_date);
                            return d >= mStart && d <= mEnd;
                        } catch { return false; }
                    });
                    const mIncomes = periodIncomes.filter(i => {
                        try {
                            const d = parseISO(i.date);
                            return d >= mStart && d <= mEnd;
                        } catch { return false; }
                    });
                    const mExpTotal = mExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                    const mIncTotal = mIncomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                    return {
                        month: format(m, 'yyyy-MM'),
                        monthLabel: format(m, 'MMMM yyyy'),
                        totalExpense: Math.round(mExpTotal),
                        totalIncome: Math.round(mIncTotal),
                        netSavings: Math.round(mIncTotal - mExpTotal)
                    };
                });
            } catch {}

            // Category Breakdown
            const catMap = {};
            periodExpenses.forEach(e => {
                const catName = e.categories?.name || 'Uncategorized';
                catMap[catName] = (catMap[catName] || 0) + (parseFloat(e.amount) || 0);
            });

            const categoryBreakdown = Object.entries(catMap)
                .map(([name, total]) => ({
                    category: name,
                    total: Math.round(total),
                    percent: totalExpense > 0 ? parseFloat(((total / totalExpense) * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => b.total - a.total);

            // Income Sources Breakdown
            const incomeSourceMap = {};
            periodIncomes.forEach(i => {
                const s = i.source || 'Income';
                incomeSourceMap[s] = (incomeSourceMap[s] || 0) + (parseFloat(i.amount) || 0);
            });
            const incomeSources = Object.entries(incomeSourceMap)
                .map(([source, total]) => ({
                    source,
                    total: Math.round(total),
                    percent: totalIncome > 0 ? parseFloat(((total / totalIncome) * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => b.total - a.total);

            return {
                dateRange: `${startDate} to ${endDate}`,
                scope: activeScope,
                totalExpense: Math.round(totalExpense),
                totalIncome: Math.round(totalIncome),
                netSavings: Math.round(netSavings),
                transactionCount: periodExpenses.length,
                incomeCount: periodIncomes.length,
                monthlyBreakdown,
                categoryBreakdown,
                incomeSources,
                currency: 'INR'
            };
        }

        case 'compareSpendingPeriods': {
            const { period1Start, period1End, period2Start, period2End, category } = args;

            const calcPeriod = (sDate, eDate) => {
                const s = startOfDay(parseISO(sDate));
                const e = endOfDay(parseISO(eDate));

                let exps = scopedExpenses.filter(exp => {
                    try {
                        return isWithinInterval(parseISO(exp.transaction_date), { start: s, end: e });
                    } catch {
                        return false;
                    }
                });

                if (category && category.trim()) {
                    const cLower = category.toLowerCase().trim();
                    exps = exps.filter(exp => (exp.categories?.name || '').toLowerCase().includes(cLower));
                }

                let incs = scopedIncomes.filter(inc => {
                    try {
                        return isWithinInterval(parseISO(inc.date), { start: s, end: e });
                    } catch {
                        return false;
                    }
                });

                const totalExpense = exps.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
                const totalIncome = incs.reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);

                return {
                    totalExpense: Math.round(totalExpense),
                    totalIncome: Math.round(totalIncome),
                    netSavings: Math.round(totalIncome - totalExpense),
                    expenseCount: exps.length,
                    incomeCount: incs.length
                };
            };

            const p1 = calcPeriod(period1Start, period1End);
            const p2 = calcPeriod(period2Start, period2End);

            const expenseDiff = p2.totalExpense - p1.totalExpense;
            const expensePercentChange = p1.totalExpense > 0
                ? parseFloat((((p2.totalExpense - p1.totalExpense) / p1.totalExpense) * 100).toFixed(1))
                : null;

            const incomeDiff = p2.totalIncome - p1.totalIncome;
            const incomePercentChange = p1.totalIncome > 0
                ? parseFloat((((p2.totalIncome - p1.totalIncome) / p1.totalIncome) * 100).toFixed(1))
                : null;

            return {
                period1: { range: `${period1Start} to ${period1End}`, ...p1 },
                period2: { range: `${period2Start} to ${period2End}`, ...p2 },
                expenseDifference: expenseDiff,
                expensePercentChange,
                incomeDifference: incomeDiff,
                incomePercentChange,
                expenseTrend: expenseDiff > 0 ? 'increased' : expenseDiff < 0 ? 'decreased' : 'unchanged',
                incomeTrend: incomeDiff > 0 ? 'increased' : incomeDiff < 0 ? 'decreased' : 'unchanged',
                currency: 'INR'
            };
        }

        case 'getBudgetStatus': {
            const { startDate, endDate } = args;
            const targetDate = startDate ? parseISO(startDate) : new Date();

            const activeBudgets = budgets.filter(b => {
                try {
                    const bStart = parseISO(b.start_date);
                    const bEnd = endOfDay(parseISO(b.end_date));
                    return targetDate >= bStart && targetDate <= bEnd;
                } catch {
                    return false;
                }
            });

            const statusList = activeBudgets.map(b => {
                const isOverall = !b.category_id;
                const cat = isOverall ? null : categories.find(c => c.id === b.category_id);
                const limitAmount = parseFloat(b.amount) || 0;

                const spent = scopedExpenses
                    .filter(e => {
                        if (!isOverall && e.category_id !== b.category_id) return false;
                        if (isOverall && e.exclude_from_budget) return false;
                        try {
                            const d = parseISO(e.transaction_date);
                            return d >= parseISO(b.start_date) && d <= endOfDay(parseISO(b.end_date));
                        } catch {
                            return false;
                        }
                    })
                    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                const remaining = Math.max(0, limitAmount - spent);
                const percentUsed = limitAmount > 0 ? parseFloat(((spent / limitAmount) * 100).toFixed(1)) : 0;

                return {
                    name: isOverall ? 'Overall Monthly Budget' : (cat?.name || 'Category'),
                    category: isOverall ? 'Overall' : (cat?.name || 'Category'),
                    limit: limitAmount,
                    spent: Math.round(spent),
                    remaining: Math.round(remaining),
                    percentUsed,
                    isOverBudget: spent > limitAmount
                };
            });

            return {
                budgetItems: statusList,
                currency: 'INR'
            };
        }

        case 'getRecurringSubscriptions': {
            const recurring = scopedExpenses
                .filter(e => e.is_recurring)
                .map(e => ({
                    description: e.description,
                    amount: parseFloat(e.amount) || 0,
                    category: e.categories?.name || 'General',
                    lastDate: e.transaction_date
                }));

            const totalMonthly = recurring.reduce((sum, r) => sum + r.amount, 0);

            return {
                count: recurring.length,
                totalMonthlyEstimate: Math.round(totalMonthly),
                subscriptions: recurring,
                currency: 'INR'
            };
        }

        default:
            return { error: `Tool ${toolName} not implemented.` };
    }
};
