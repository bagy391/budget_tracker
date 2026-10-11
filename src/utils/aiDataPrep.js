import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, endOfDay } from 'date-fns';
import { formatCurrency } from './calculations.js';

/**
 * Prepares and aggregates financial data into a structured context for the LLM.
 * Supports both 'personal' (current user only) and 'family' (all household members) scopes.
 *
 * @param {Object} options
 * @param {Array} options.expenses - All family expenses
 * @param {Array} options.incomes - All family incomes
 * @param {Array} options.budgets - All budgets
 * @param {Array} options.categories - All categories
 * @param {Array} options.paymentMethods - All payment methods
 * @param {Object} options.currentFamily - Selected family object
 * @param {Object} options.currentUser - Logged-in user object
 * @param {string} options.scope - 'personal' | 'family'
 * @param {Date} [options.targetDate] - Reference date (defaults to current date)
 */
export const prepareFinancialContext = ({
    expenses = [],
    incomes = [],
    budgets = [],
    categories = [],
    paymentMethods = [],
    wealthAssets = [],
    currentFamily = null,
    currentUser = null,
    scope = 'personal', // 'personal' | 'family' for Wealth Portfolio analysis
    targetDate = new Date()
}) => {
    const currentUserId = currentUser?.id;
    const currentUserName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'User';

    // 1. Expenses & Incomes are ALWAYS Family-wide (Household cashflow)
    const scopedExpenses = expenses;
    const scopedIncomes = incomes;

    // 2. Date ranges (Current month vs Previous month)
    const currentMonthStart = startOfMonth(targetDate);
    const currentMonthEnd = endOfMonth(targetDate);
    const prevMonthDate = subMonths(targetDate, 1);
    const prevMonthStart = startOfMonth(prevMonthDate);
    const prevMonthEnd = endOfMonth(prevMonthDate);

    const isCurrentMonth = (dateStr) => {
        if (!dateStr) return false;
        try {
            const d = parseISO(dateStr);
            return isWithinInterval(d, { start: currentMonthStart, end: endOfDay(currentMonthEnd) });
        } catch {
            return false;
        }
    };

    const isPrevMonth = (dateStr) => {
        if (!dateStr) return false;
        try {
            const d = parseISO(dateStr);
            return isWithinInterval(d, { start: prevMonthStart, end: endOfDay(prevMonthEnd) });
        } catch {
            return false;
        }
    };

    // Current month transactions
    const currentMonthExpenses = scopedExpenses.filter(e => isCurrentMonth(e.transaction_date));
    const currentMonthIncomes = scopedIncomes.filter(i => isCurrentMonth(i.date));

    // Previous month transactions
    const prevMonthExpenses = scopedExpenses.filter(e => isPrevMonth(e.transaction_date));
    const prevMonthIncomes = scopedIncomes.filter(i => isPrevMonth(i.date));

    // 3. Totals
    const currentTotalExpense = currentMonthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const currentTotalIncome = currentMonthIncomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const prevTotalExpense = prevMonthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const prevTotalIncome = prevMonthIncomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    const netSavings = currentTotalIncome - currentTotalExpense;
    const savingsRate = currentTotalIncome > 0 ? ((netSavings / currentTotalIncome) * 100).toFixed(1) : 0;

    // Expense MoM change
    const expenseChangePercent = prevTotalExpense > 0
        ? (((currentTotalExpense - prevTotalExpense) / prevTotalExpense) * 100).toFixed(1)
        : null;

    // 4. Category breakdown for current month
    const categoryMap = {};
    categories.forEach(cat => {
        categoryMap[cat.id] = {
            id: cat.id,
            name: cat.name,
            icon: cat.icon || '📁',
            currentSpend: 0,
            prevSpend: 0,
            transactionCount: 0
        };
    });

    currentMonthExpenses.forEach(exp => {
        const catId = exp.category_id || 'uncategorized';
        if (!categoryMap[catId]) {
            categoryMap[catId] = {
                id: catId,
                name: exp.categories?.name || 'Uncategorized',
                icon: exp.categories?.icon || '📦',
                currentSpend: 0,
                prevSpend: 0,
                transactionCount: 0
            };
        }
        categoryMap[catId].currentSpend += (parseFloat(exp.amount) || 0);
        categoryMap[catId].transactionCount += 1;
    });

    prevMonthExpenses.forEach(exp => {
        const catId = exp.category_id || 'uncategorized';
        if (categoryMap[catId]) {
            categoryMap[catId].prevSpend += (parseFloat(exp.amount) || 0);
        }
    });

    // Match with current budgets
    const currentBudgetItems = budgets.filter(b => {
        try {
            const bStart = parseISO(b.start_date);
            const bEnd = endOfDay(parseISO(b.end_date));
            return targetDate >= bStart && targetDate <= bEnd;
        } catch {
            return false;
        }
    });

    const categoryAnalysis = Object.values(categoryMap)
        .filter(c => c.currentSpend > 0 || c.prevSpend > 0)
        .map(cat => {
            const budgetMatch = currentBudgetItems.find(b => b.category_id === cat.id);
            const budgetLimit = budgetMatch ? parseFloat(budgetMatch.amount) : null;
            const percentOfTotal = currentTotalExpense > 0
                ? ((cat.currentSpend / currentTotalExpense) * 100).toFixed(1)
                : 0;

            const momChange = cat.prevSpend > 0
                ? (((cat.currentSpend - cat.prevSpend) / cat.prevSpend) * 100).toFixed(1)
                : null;

            return {
                ...cat,
                budgetLimit,
                percentOfTotal: parseFloat(percentOfTotal),
                isOverBudget: budgetLimit !== null ? cat.currentSpend > budgetLimit : false,
                budgetUsedPercent: budgetLimit ? ((cat.currentSpend / budgetLimit) * 100).toFixed(1) : null,
                momChange: momChange !== null ? parseFloat(momChange) : null
            };
        })
        .sort((a, b) => b.currentSpend - a.currentSpend);

    // 5. Burn Rate & Day Velocity
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyAverageSpend = dayOfMonth > 0 ? (currentTotalExpense / dayOfMonth) : 0;
    const projectedMonthEndSpend = dailyAverageSpend * daysInMonth;

    // Overall Monthly Budget (primary budget without category_id, or first budget)
    const overallBudgetObj = currentBudgetItems.find(b => !b.category_id) || (currentBudgetItems.length === 1 ? currentBudgetItems[0] : null);
    let overallBudget = null;

    if (overallBudgetObj) {
        const budgetLimit = parseFloat(overallBudgetObj.amount) || 0;
        const bStart = parseISO(overallBudgetObj.start_date);
        const bEnd = endOfDay(parseISO(overallBudgetObj.end_date));

        const budgetExpenses = scopedExpenses.filter(e => {
            if (e.exclude_from_budget) return false;
            try {
                const d = parseISO(e.transaction_date);
                return d >= bStart && d <= bEnd;
            } catch {
                return false;
            }
        });

        const spent = budgetExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const remaining = Math.max(0, budgetLimit - spent);
        const percentUsed = budgetLimit > 0 ? parseFloat(((spent / budgetLimit) * 100).toFixed(1)) : 0;
        const daysLeftInMonth = Math.max(0, daysInMonth - dayOfMonth);
        const projectedOver = projectedMonthEndSpend > budgetLimit;
        const projectedDiff = Math.round(projectedMonthEndSpend - budgetLimit);
        const safeDailySpend = daysLeftInMonth > 0 ? Math.round(remaining / daysLeftInMonth) : 0;

        overallBudget = {
            id: overallBudgetObj.id,
            limit: budgetLimit,
            spent: Math.round(spent),
            remaining: Math.round(remaining),
            percentUsed,
            isOverBudget: spent > budgetLimit,
            projectedOver,
            projectedDiff,
            daysLeft: daysLeftInMonth,
            safeDailySpend
        };
    }

    // 6. Top 5 Largest Expenses this month
    const topExpenses = [...currentMonthExpenses]
        .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
        .slice(0, 5)
        .map(e => ({
            title: e.title || e.description || e.categories?.name || 'Expense',
            description: e.description || '',
            amount: parseFloat(e.amount) || 0,
            category: e.categories?.name || 'General',
            date: e.transaction_date,
            paymentMethod: e.payment_methods?.name || 'N/A',
            spender: e.profiles?.full_name || 'Member'
        }));

    // 7. Recurring / Subscription Candidates
    const recurringExpenses = currentMonthExpenses
        .filter(e => e.is_recurring)
        .map(e => ({
            title: e.title || e.description || 'Subscription',
            description: e.description || '',
            amount: parseFloat(e.amount) || 0,
            category: e.categories?.name || 'General'
        }));

    // 8. Payment Method Breakdown
    const paymentMap = {};
    currentMonthExpenses.forEach(exp => {
        const pmName = exp.payment_methods?.name || 'Other';
        paymentMap[pmName] = (paymentMap[pmName] || 0) + (parseFloat(exp.amount) || 0);
    });

    // 9. Family Members Breakdown (Household cashflow)
    const memberBreakdown = {};
    currentMonthExpenses.forEach(exp => {
        const memberName = exp.profiles?.full_name || exp.profiles?.email || 'Unknown';
        memberBreakdown[memberName] = (memberBreakdown[memberName] || 0) + (parseFloat(exp.amount) || 0);
    });

    // Income source breakdown
    const currentIncomeSourcesMap = {};
    currentMonthIncomes.forEach(i => {
        const src = i.source || 'General Income';
        currentIncomeSourcesMap[src] = (currentIncomeSourcesMap[src] || 0) + (parseFloat(i.amount) || 0);
    });
    const currentIncomeSources = Object.entries(currentIncomeSourcesMap)
        .map(([source, total]) => ({ source, total: Math.round(total) }))
        .sort((a, b) => b.total - a.total);

    // 10. Recent Raw Transactions Ledger (up to 40 recent items for factual Q&A)
    const recentLedger = scopedExpenses.slice(0, 40).map(e => ({
        date: e.transaction_date,
        title: e.title || e.description || 'Expense',
        description: e.description || '',
        category: e.categories?.name || 'Uncategorized',
        amount: parseFloat(e.amount) || 0,
        payment: e.payment_methods?.name || 'N/A',
        spender: e.profiles?.full_name || 'Member'
    }));

    // 11. Recent Raw Incomes Ledger (up to 20 recent items)
    const recentIncomes = scopedIncomes.slice(0, 20).map(i => ({
        date: i.date,
        source: i.source || 'Income',
        amount: parseFloat(i.amount) || 0,
        spender: i.profiles?.full_name || 'Member'
    }));

    // 12. Wealth Portfolio Analysis (Personal vs Family)
    const myAssets = wealthAssets.filter(a => a.isOwner);
    const sharedAssets = wealthAssets.filter(a => !a.isOwner);
    const familyAssets = [...myAssets, ...sharedAssets];

    const calcPortfolio = (assets, label) => {
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
            gains: (parseFloat(a.current_amount) || 0) - (parseFloat(a.invested_amount) || 0),
            roi: parseFloat(a.invested_amount) > 0
                ? parseFloat(((((parseFloat(a.current_amount) || 0) - parseFloat(a.invested_amount)) / parseFloat(a.invested_amount)) * 100).toFixed(1))
                : 0,
            isOwner: !!a.isOwner,
            maturityDate: a.maturity_date || null
        })).sort((a, b) => b.current - a.current);

        return {
            label,
            totalNetWorth: Math.round(totalCurrent),
            totalInvested: Math.round(totalInvested),
            totalGains: Math.round(totalGains),
            roi,
            assetCount: assets.length,
            allocation,
            assetList
        };
    };

    const myPortfolio = calcPortfolio(myAssets, 'Personal Wealth');
    const familyPortfolio = calcPortfolio(familyAssets, 'Family Wealth');
    const activeWealthScope = scope === 'family' ? 'family' : 'personal';
    const activePortfolio = activeWealthScope === 'family' ? familyPortfolio : myPortfolio;

    return {
        scope,
        isPersonal: false, // Cashflow is always family-wide
        wealthScope: activeWealthScope,
        userName: currentUserName,
        familyName: currentFamily?.name || 'My Family',
        currentMonthLabel: format(targetDate, 'MMMM yyyy'),
        prevMonthLabel: format(prevMonthDate, 'MMMM yyyy'),
        currentDay: dayOfMonth,
        daysInMonth,
        totals: {
            income: currentTotalIncome,
            incomeSources: currentIncomeSources,
            expense: currentTotalExpense,
            netSavings,
            savingsRate,
            prevIncome: prevTotalIncome,
            prevExpense: prevTotalExpense,
            expenseChangePercent,
            dailyAverageSpend: Math.round(dailyAverageSpend),
            projectedMonthEndSpend: Math.round(projectedMonthEndSpend)
        },
        categoryAnalysis,
        overallBudget,
        topExpenses,
        recurringExpenses,
        paymentMap,
        memberBreakdown,
        recentLedger,
        recentIncomes,
        wealth: {
            scope: activeWealthScope,
            active: activePortfolio,
            my: myPortfolio,
            family: familyPortfolio
        }
    };
};

/**
 * Formats the financial data into a clean, markdown-friendly text block for Gemini system prompt.
 */
export const buildPromptContextString = (finData) => {
    const {
        isPersonal,
        userName,
        familyName,
        currentMonthLabel,
        totals,
        categoryAnalysis,
        topExpenses,
        recurringExpenses,
        paymentMap,
        memberBreakdown,
        recentLedger
    } = finData;

    let text = `### FINANCIAL OVERVIEW (${currentMonthLabel})\n`;
    text += `- **Cashflow Scope**: Unified Household / Family (${familyName}) (all incomes and expenses across all members)\n`;
    if (finData.wealth?.active) {
        text += `- **Wealth Portfolio Mode**: ${finData.wealth.active.label}\n`;
    }
    text += `- **Total Incomes**: ${formatCurrency(totals.income)}\n`;
    text += `- **Total Expenses**: ${formatCurrency(totals.expense)} (Last month: ${formatCurrency(totals.prevExpense)}${totals.expenseChangePercent !== null ? `, change: ${totals.expenseChangePercent}%` : ''})\n`;
    text += `- **Net Savings**: ${formatCurrency(totals.netSavings)} (${totals.savingsRate}% savings rate)\n`;
    text += `- **Current Daily Burn Rate**: ${formatCurrency(totals.dailyAverageSpend)}/day\n`;
    text += `- **Projected End-of-Month Spend**: ${formatCurrency(totals.projectedMonthEndSpend)}\n\n`;

    text += `### SPENDING BY CATEGORY (${currentMonthLabel}):\n`;
    if (categoryAnalysis.length === 0) {
        text += `- No expenses recorded in this period.\n`;
    } else {
        categoryAnalysis.forEach(c => {
            const momText = c.momChange !== null ? ` | MoM: ${c.momChange > 0 ? '+' : ''}${c.momChange}%` : '';
            const budgetText = c.budgetLimit !== null
                ? ` | Budget: ${formatCurrency(c.budgetLimit)} (${c.budgetUsedPercent}% used${c.isOverBudget ? ' ⚠️ OVER BUDGET' : ''})`
                : '';
            text += `- ${c.name}: ${formatCurrency(c.currentSpend)} (${c.percentOfTotal}% of total spend, ${c.transactionCount} transactions${momText}${budgetText})\n`;
        });
    }
    text += `\n`;

    if (topExpenses.length > 0) {
        text += `### TOP 5 LARGEST TRANSACTIONS THIS MONTH:\n`;
        topExpenses.forEach(t => {
            text += `- ${t.date} | ${t.description} | ${formatCurrency(t.amount)} | Category: ${t.category} | Spender: ${t.spender}\n`;
        });
        text += `\n`;
    }

    if (recurringExpenses.length > 0) {
        text += `### RECURRING SUBSCRIPTIONS / BILLS:\n`;
        recurringExpenses.forEach(r => {
            text += `- ${r.description} | ${formatCurrency(r.amount)} (${r.category})\n`;
        });
        text += `\n`;
    }

    if (Object.keys(paymentMap).length > 0) {
        text += `### PAYMENT METHOD BREAKDOWN:\n`;
        Object.entries(paymentMap).forEach(([pm, amt]) => {
            text += `- ${pm}: ${formatCurrency(amt)}\n`;
        });
        text += `\n`;
    }

    if (!isPersonal && Object.keys(memberBreakdown).length > 0) {
        text += `### FAMILY MEMBER CONTRIBUTIONS:\n`;
        Object.entries(memberBreakdown).forEach(([member, amt]) => {
            const pct = totals.expense > 0 ? ((amt / totals.expense) * 100).toFixed(1) : 0;
            text += `- ${member}: ${formatCurrency(amt)} (${pct}% of family total)\n`;
        });
        text += `\n`;
    }

    if (recentLedger.length > 0) {
        text += `### RECENT TRANSACTIONS LEDGER (Last ${recentLedger.length} items):\n`;
        recentLedger.forEach(l => {
            text += `- [${l.date}] ${l.description}: ${formatCurrency(l.amount)} (${l.category}, via ${l.payment}, by ${l.spender})\n`;
        });
        text += `\n`;
    }

    if (finData.wealth?.active) {
        const { active, my, family } = finData.wealth;
        text += `### WEALTH & INVESTMENT PORTFOLIO (${active.label}):\n`;
        text += `- **Active Portfolio Scope**: ${active.label} (Net Worth: ${formatCurrency(active.totalNetWorth)}, Invested: ${formatCurrency(active.totalInvested)}, Returns/Gains: ${formatCurrency(active.totalGains)}, Overall ROI: ${active.roi}% across ${active.assetCount} assets)\n`;
        text += `- **Personal Portfolio**: Net Worth ${formatCurrency(my.totalNetWorth)}, Invested ${formatCurrency(my.totalInvested)}, Gains ${formatCurrency(my.totalGains)} (${my.roi}% ROI across ${my.assetCount} assets)\n`;
        text += `- **Family Portfolio**: Net Worth ${formatCurrency(family.totalNetWorth)}, Invested ${formatCurrency(family.totalInvested)}, Gains ${formatCurrency(family.totalGains)} (${family.roi}% ROI across ${family.assetCount} assets)\n`;
        if (active.allocation.length > 0) {
            text += `- **Asset Class Allocation (${active.label})**:\n`;
            active.allocation.forEach(a => {
                text += `  • ${a.type.toUpperCase()}: ${formatCurrency(a.totalCurrent)} (${a.percentOfPortfolio}%, Invested: ${formatCurrency(a.totalInvested)}, Gains: ${formatCurrency(a.gains)})\n`;
            });
        }
        text += `\n`;
    }

    return text;
};
