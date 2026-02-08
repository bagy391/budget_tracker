import { format, startOfMonth, endOfMonth, differenceInDays, parseISO, isWithinInterval } from 'date-fns';

/**
 * Calculate budget statistics
 */
export const calculateBudgetStats = (budget, expenses) => {
    if (!budget) {
        return {
            total: 0,
            spent: 0,
            remaining: 0,
            percentage: 0,
            safeToSpend: 0,
            daysLeft: 0
        };
    }

    const budgetAmount = parseFloat(budget.amount) || 0;

    // Filter expenses within budget period
    const budgetExpenses = expenses.filter(expense => {
        const expenseDate = parseISO(expense.transaction_date);
        return isWithinInterval(expenseDate, {
            start: parseISO(budget.start_date),
            end: parseISO(budget.end_date)
        });
    });

    const spent = budgetExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    const remaining = Math.max(0, budgetAmount - spent);
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

    // Calculate days left
    const today = new Date();
    const endDate = parseISO(budget.end_date);
    const daysLeft = Math.max(0, differenceInDays(endDate, today) + 1);

    // Calculate safe to spend per day
    const safeToSpend = daysLeft > 0 ? remaining / daysLeft : 0;

    return {
        total: budgetAmount,
        spent,
        remaining,
        percentage: Math.min(100, percentage),
        safeToSpend,
        daysLeft
    };
};

/**
 * Filter transactions by date range
 */
export const filterByDateRange = (transactions, startDate, endDate) => {
    return transactions.filter(transaction => {
        const transactionDate = parseISO(transaction.transaction_date || transaction.date);
        return isWithinInterval(transactionDate, {
            start: startDate,
            end: endDate
        });
    });
};

/**
 * Group transactions by category with totals
 */
export const groupByCategory = (expenses, categories) => {
    const categoryMap = {};

    expenses.forEach(expense => {
        const categoryId = expense.category_id;
        if (!categoryMap[categoryId]) {
            const category = categories.find(c => c.id === categoryId);
            categoryMap[categoryId] = {
                id: categoryId,
                name: category?.name || 'Uncategorized',
                icon: category?.icon || '📦',
                total: 0,
                count: 0
            };
        }
        categoryMap[categoryId].total += parseFloat(expense.amount || 0);
        categoryMap[categoryId].count += 1;
    });

    return Object.values(categoryMap).sort((a, b) => b.total - a.total);
};

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
    }).format(Math.round(value * 100) / 100);
};

/**
 * Format date
 */
export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
    if (!date) return '';
    return format(parseISO(date), formatStr);
};

/**
 * Get current month budget period
 */
export const getCurrentMonthPeriod = () => {
    const now = new Date();
    return {
        start: startOfMonth(now),
        end: endOfMonth(now)
    };
};

/**
 * Generate chart color based on index
 */
export const getChartColor = (index) => {
    const colors = [
        '#6366f1', // primary
        '#a855f7', // secondary
        '#ec4899', // accent
        '#10b981', // success
        '#f59e0b', // warning
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#14b8a6', // teal
        '#f97316', // orange
        '#06b6d4'  // cyan
    ];
    return colors[index % colors.length];
};
