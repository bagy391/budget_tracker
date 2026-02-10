import React, { useState, useMemo } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency, groupByCategory, getChartColor } from '../utils/calculations';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import Card from '../components/common/Card';
import Select from '../components/common/Select';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
    const { expenses, incomes, budgets, categories, paymentMethods, wealthAssets, currentFamily, loading } = useBudget();
    const [period, setPeriod] = useState('3months');

    // Hook to get window width for responsive pie charts
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Responsive pie chart sizing
    const pieChartSize = useMemo(() => {
        if (windowWidth <= 480) {
            return { radius: 85, height: 280 };
        } else if (windowWidth <= 768) {
            return { radius: 95, height: 290 };
        }
        return { radius: 110, height: 320 };
    }, [windowWidth]);

    const periodOptions = [
        { value: 'month', label: 'This Month' },
        { value: '3months', label: 'Last 3 Months' },
        { value: '6months', label: 'Last 6 Months' },
        { value: 'year', label: 'This Year' }
    ];

    // Calculate date range
    const dateRange = useMemo(() => {
        const now = new Date();
        let start;

        switch (period) {
            case 'month':
                start = startOfMonth(now);
                break;
            case '3months':
                start = startOfMonth(subMonths(now, 2));
                break;
            case '6months':
                start = startOfMonth(subMonths(now, 5));
                break;
            case 'year':
                start = startOfMonth(subMonths(now, 11));
                break;
            default:
                start = startOfMonth(subMonths(now, 2));
        }

        return {
            start,
            end: endOfMonth(now)
        };
    }, [period]);

    // Filter data by date range
    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const date = parseISO(e.transaction_date);
            return date >= dateRange.start && date <= dateRange.end;
        });
    }, [expenses, dateRange]);

    const filteredIncomes = useMemo(() => {
        return incomes.filter(i => {
            const date = parseISO(i.date);
            return date >= dateRange.start && date <= dateRange.end;
        });
    }, [incomes, dateRange]);

    // Spending trends by month
    const spendingTrendsData = useMemo(() => {
        const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const monthExpenses = filteredExpenses.filter(e => {
                const date = parseISO(e.transaction_date);
                return date >= monthStart && date <= monthEnd;
            });

            const total = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

            return {
                month: format(month, 'MMM yyyy'),
                amount: total
            };
        });
    }, [filteredExpenses, dateRange]);

    // Category breakdown
    const categoryData = useMemo(() => {
        const grouped = groupByCategory(filteredExpenses, categories);
        return grouped.map((cat, index) => ({
            name: cat.name,
            value: cat.total,
            icon: cat.icon,
            color: getChartColor(index)
        }));
    }, [filteredExpenses, categories]);

    // Payment type breakdown
    const paymentTypeData = useMemo(() => {
        const paymentGroups = {};

        filteredExpenses.forEach(expense => {
            const paymentMethod = expense.payment_methods;
            if (paymentMethod) {
                const name = paymentMethod.name;
                if (!paymentGroups[name]) {
                    paymentGroups[name] = {
                        name: name,
                        value: 0
                    };
                }
                paymentGroups[name].value += parseFloat(expense.amount);
            }
        });

        return Object.values(paymentGroups).map((item, index) => ({
            ...item,
            color: getChartColor(index + categoryData.length)
        }));
    }, [filteredExpenses, categoryData.length]);

    // Budget utilization history
    const budgetUtilizationData = useMemo(() => {
        const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            // Find budget for this month
            const monthBudget = budgets.find(b => {
                const bStart = parseISO(b.start_date);
                const bEnd = parseISO(b.end_date);
                return month >= bStart && month <= bEnd;
            });

            const monthExpenses = expenses.filter(e => {
                const date = parseISO(e.transaction_date);
                return date >= monthStart && date <= monthEnd;
            });

            const spent = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const budgetAmount = monthBudget ? parseFloat(monthBudget.amount) : 0;

            return {
                month: format(month, 'MMM yyyy'),
                budget: budgetAmount,
                spent: spent
            };
        });
    }, [expenses, budgets, dateRange]);

    // Income tracking
    const incomeData = useMemo(() => {
        const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const monthIncomes = filteredIncomes.filter(i => {
                const date = parseISO(i.date);
                return date >= monthStart && date <= monthEnd;
            });

            const total = monthIncomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);

            return {
                month: format(month, 'MMM yyyy'),
                income: total
            };
        });
    }, [filteredIncomes, dateRange]);

    // Income vs Expense comparison
    const comparisonData = useMemo(() => {
        const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const monthExpenses = filteredExpenses.filter(e => {
                const date = parseISO(e.transaction_date);
                return date >= monthStart && date <= monthEnd;
            });

            const monthIncomes = filteredIncomes.filter(i => {
                const date = parseISO(i.date);
                return date >= monthStart && date <= monthEnd;
            });

            const expenseTotal = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const incomeTotal = monthIncomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);

            return {
                month: format(month, 'MMM yyyy'),
                expense: expenseTotal,
                income: incomeTotal
            };
        });
    }, [filteredExpenses, filteredIncomes, dateRange]);

    // Calculate wealth statistics
    const wealthStats = useMemo(() => {
        const myAssets = wealthAssets.filter(a => a.isOwner);
        const sharedAssets = wealthAssets.filter(a => !a.isOwner);

        console.log('=== Wealth Stats Debug ===');
        console.log('Total wealthAssets:', wealthAssets.length);
        console.log('My assets:', myAssets.length);
        console.log('Shared assets:', sharedAssets.length);

        // My Current Wealth: Only my own assets
        const myTotal = myAssets.reduce((sum, a) => sum + (parseFloat(a.current_amount) || 0), 0);
        const myInvested = myAssets.reduce((sum, a) => sum + (parseFloat(a.invested_amount) || 0), 0);
        const myGains = myTotal - myInvested;
        const myROI = myInvested > 0 ? ((myGains / myInvested) * 100) : 0;

        // Group my assets by type
        const myAssetsByType = myAssets.reduce((acc, asset) => {
            const type = asset.asset_type;
            if (!acc[type]) {
                acc[type] = { total: 0, count: 0 };
            }
            acc[type].total += parseFloat(asset.current_amount) || 0;
            acc[type].count += 1;
            return acc;
        }, {});

        // Family Wealth: My assets + shared assets from family members
        const familyAssets = [...myAssets, ...sharedAssets];
        const familyTotal = familyAssets.reduce((sum, a) => sum + (parseFloat(a.current_amount) || 0), 0);
        const familyInvested = familyAssets.reduce((sum, a) => sum + (parseFloat(a.invested_amount) || 0), 0);
        const familyGains = familyTotal - familyInvested;
        const familyROI = familyInvested > 0 ? ((familyGains / familyInvested) * 100) : 0;

        // Group family assets by type (including both my assets and shared assets)
        const familyAssetsByType = familyAssets.reduce((acc, asset) => {
            const type = asset.asset_type;
            if (!acc[type]) {
                acc[type] = { total: 0, count: 0 };
            }
            acc[type].total += parseFloat(asset.current_amount) || 0;
            acc[type].count += 1;
            return acc;
        }, {});

        console.log('My Wealth Total:', myTotal);
        console.log('Family Wealth Total:', familyTotal);
        console.log('Family hasData:', familyAssets.length > 0);
        console.log('My assets by type:', myAssetsByType);
        console.log('Family assets by type:', familyAssetsByType);
        console.log('All my assets:', myAssets.map(a => ({ name: a.asset_name, type: a.asset_type })));
        console.log('All family assets:', familyAssets.map(a => ({ name: a.asset_name, type: a.asset_type })));

        return {
            my: { total: myTotal, invested: myInvested, gains: myGains, roi: myROI, byType: myAssetsByType },
            family: { total: familyTotal, invested: familyInvested, gains: familyGains, roi: familyROI, byType: familyAssetsByType, hasData: familyAssets.length > 0 }
        };
    }, [wealthAssets, currentFamily]);

    const ASSET_TYPE_LABELS = {
        mutual_fund: { label: 'Mutual Funds', icon: '📈', color: '#3b82f6' },
        stock: { label: 'Stocks', icon: '📊', color: '#8b5cf6' },
        epf: { label: 'EPF', icon: '🏦', color: '#10b981' },
        nps: { label: 'NPS', icon: '🏛️', color: '#f59e0b' },
        bank: { label: 'Bank', icon: '💰', color: '#06b6d4' },
        fd: { label: 'Fixed Deposits', icon: '🏅', color: '#ec4899' }
    };

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    // No family selected
    if (expenses.length === 0 && incomes.length === 0 && budgets.length === 0) {
        return (
            <div className="dashboard">
                <h1 className="dashboard-title">Dashboard</h1>
                <Card>
                    <div className="chart-empty" style={{ padding: 'var(--space-2xl)' }}>
                        <p style={{ fontSize: '4rem', marginBottom: 'var(--space-lg)' }}>👨‍👩‍👧‍👦</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
                            No Family Selected
                        </p>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Create or select a family from Settings to view charts and analytics
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-label">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {formatCurrency(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const CustomPieTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-label">{payload[0].payload.icon} {payload[0].name}</p>
                    <p style={{ color: payload[0].payload.color }}>
                        {formatCurrency(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title">Dashboard</h1>
                <Select
                    value={period}
                    onChange={setPeriod}
                    options={periodOptions}
                    icon="📊"
                />
            </div>

            {/* Summary Statistics */}
            <div className="dashboard-summary">
                <Card className="summary-card">
                    <div className="summary-icon">💰</div>
                    <div className="summary-content">
                        <p className="summary-label">Total Income</p>
                        <p className="summary-value income">{formatCurrency(filteredIncomes.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0))}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="summary-icon">💸</div>
                    <div className="summary-content">
                        <p className="summary-label">Total Expenses</p>
                        <p className="summary-value expense">{formatCurrency(filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0))}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="summary-icon">📊</div>
                    <div className="summary-content">
                        <p className="summary-label">Net Savings</p>
                        <p className={`summary-value ${(filteredIncomes.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0) - filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)) >= 0 ? 'income' : 'expense'}`}>
                            {formatCurrency(filteredIncomes.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0) - filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0))}
                        </p>
                    </div>
                </Card>
            </div>

            {/* My Wealth Section */}
            {wealthStats.my.total > 0 && (
                <Card className="wealth-section">
                    <h3 className="chart-title">💎 My Wealth</h3>
                    <div className="wealth-summary">
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Total</span>
                            <span className="wealth-stat-value">{formatCurrency(wealthStats.my.total)}</span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Invested</span>
                            <span className="wealth-stat-value">{formatCurrency(wealthStats.my.invested)}</span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Gains/Loss</span>
                            <span className={`wealth-stat-value ${wealthStats.my.gains >= 0 ? 'positive' : 'negative'}`}>
                                {wealthStats.my.gains >= 0 ? '📈' : '📉'} {formatCurrency(Math.abs(wealthStats.my.gains))}
                            </span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">ROI</span>
                            <span className={`wealth-stat-value ${wealthStats.my.roi >= 0 ? 'positive' : 'negative'}`}>
                                {wealthStats.my.roi.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    {Object.keys(wealthStats.my.byType).length > 0 && (
                        <>
                            <ResponsiveContainer width="100%" height={pieChartSize.height}>
                                <PieChart>
                                    <Pie
                                        data={Object.entries(wealthStats.my.byType).map(([type, data]) => ({
                                            name: ASSET_TYPE_LABELS[type]?.label || type,
                                            value: data.total,
                                            icon: ASSET_TYPE_LABELS[type]?.icon,
                                            color: ASSET_TYPE_LABELS[type]?.color
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => {
                                            // Hide labels on desktop (>768px) to prevent overlap, show on mobile/tablet
                                            if (windowWidth > 768) return null;
                                            const percentage = (entry.percent * 100).toFixed(1);
                                            return parseFloat(percentage) >= 1 ? `${entry.icon} ${percentage}%` : entry.icon;
                                        }}
                                        innerRadius={pieChartSize.radius * 0.6}
                                        outerRadius={pieChartSize.radius}
                                        fill="#8884d8"
                                        dataKey="value"
                                        paddingAngle={2}
                                        stroke="#1e293b"
                                        strokeWidth={2}
                                    >
                                        {Object.entries(wealthStats.my.byType).map(([type], index) => (
                                            <Cell key={`cell-${index}`} fill={ASSET_TYPE_LABELS[type]?.color || getChartColor(index)} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomPieTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="chart-legend" style={{ marginTop: 'var(--space-md)' }}>
                                {Object.entries(wealthStats.my.byType)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([type, data]) => {
                                        const typeInfo = ASSET_TYPE_LABELS[type];
                                        const percentage = ((data.total / wealthStats.my.total) * 100).toFixed(1);
                                        return (
                                            <div key={type} className="legend-item">
                                                <div className="legend-indicator" style={{ backgroundColor: typeInfo?.color }}></div>
                                                <span className="legend-icon">{typeInfo?.icon}</span>
                                                <span className="legend-label">{typeInfo?.label || type}</span>
                                                <span className="legend-value">{formatCurrency(data.total)} ({percentage}%)</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </>
                    )}
                </Card>
            )}

            {/* Family Wealth Section - Only show if user has assets in current family */}
            {wealthStats.family.hasData && (
                <Card className="wealth-section">
                    <h3 className="chart-title">👨‍👩‍👧‍👦 Family Wealth</h3>
                    <div className="wealth-summary">
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Total</span>
                            <span className="wealth-stat-value">{formatCurrency(wealthStats.family.total)}</span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Invested</span>
                            <span className="wealth-stat-value">{formatCurrency(wealthStats.family.invested)}</span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">Gains/Loss</span>
                            <span className={`wealth-stat-value ${wealthStats.family.gains >= 0 ? 'positive' : 'negative'}`}>
                                {wealthStats.family.gains >= 0 ? '📈' : '📉'} {formatCurrency(Math.abs(wealthStats.family.gains))}
                            </span>
                        </div>
                        <div className="wealth-stat">
                            <span className="wealth-stat-label">ROI</span>
                            <span className={`wealth-stat-value ${wealthStats.family.roi >= 0 ? 'positive' : 'negative'}`}>
                                {wealthStats.family.roi.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    {Object.keys(wealthStats.family.byType).length > 0 && (
                        <>
                            <ResponsiveContainer width="100%" height={pieChartSize.height}>
                                <PieChart>
                                    <Pie
                                        data={Object.entries(wealthStats.family.byType).map(([type, data]) => ({
                                            name: ASSET_TYPE_LABELS[type]?.label || type,
                                            value: data.total,
                                            icon: ASSET_TYPE_LABELS[type]?.icon,
                                            color: ASSET_TYPE_LABELS[type]?.color
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => {
                                            // Hide labels on desktop (>768px) to prevent overlap, show on mobile/tablet
                                            if (windowWidth > 768) return null;
                                            const percentage = (entry.percent * 100).toFixed(1);
                                            return parseFloat(percentage) >= 1 ? `${entry.icon} ${percentage}%` : entry.icon;
                                        }}
                                        innerRadius={pieChartSize.radius * 0.6}
                                        outerRadius={pieChartSize.radius}
                                        fill="#8884d8"
                                        dataKey="value"
                                        paddingAngle={2}
                                        stroke="#1e293b"
                                        strokeWidth={2}
                                    >
                                        {Object.entries(wealthStats.family.byType).map(([type], index) => (
                                            <Cell key={`cell-${index}`} fill={ASSET_TYPE_LABELS[type]?.color || getChartColor(index)} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomPieTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="chart-legend" style={{ marginTop: 'var(--space-md)' }}>
                                {Object.entries(wealthStats.family.byType)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([type, data]) => {
                                        const typeInfo = ASSET_TYPE_LABELS[type];
                                        const percentage = ((data.total / wealthStats.family.total) * 100).toFixed(1);
                                        return (
                                            <div key={type} className="legend-item">
                                                <div className="legend-indicator" style={{ backgroundColor: typeInfo?.color }}></div>
                                                <span className="legend-icon">{typeInfo?.icon}</span>
                                                <span className="legend-label">{typeInfo?.label || type}</span>
                                                <span className="legend-value">{formatCurrency(data.total)} ({percentage}%)</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </>
                    )}
                </Card>
            )}

            {/* Empty state for wealth - show when no assets exist */}
            {wealthAssets.length === 0 && (
                <Card className="wealth-section">
                    <div className="chart-empty" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
                        <p style={{ fontSize: '4rem', marginBottom: 'var(--space-lg)' }}>💎</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
                            No Wealth Assets Yet
                        </p>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            Track your investments, savings, and assets to see your wealth grow over time
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            💡 Go to <strong>Settings → Wealth Assets</strong> to add your first asset
                        </p>
                    </div>
                </Card>
            )}


            <div className="dashboard-charts">
                {/* Spending Trends */}
                <Card className="chart-card">
                    <h3 className="chart-title">💸 Spending Trends</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={spendingTrendsData}>
                            <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                            <YAxis
                                stroke="var(--text-secondary)"
                                style={{ fontSize: '0.75rem' }}
                                tickFormatter={(value) => formatCurrency(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#colorAmount)"
                                dot={{ fill: '#6366f1', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>

                {/* Income vs Expense Comparison */}
                <Card className="chart-card">
                    <h3 className="chart-title">📊 Income vs Expense Comparison</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                            <YAxis
                                stroke="var(--text-secondary)"
                                style={{ fontSize: '0.75rem' }}
                                tickFormatter={(value) => formatCurrency(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="income" fill="var(--success)" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="expense" fill="var(--danger)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Category Breakdown */}
                <Card className="chart-card">
                    <h3 className="chart-title">📂 Category Breakdown</h3>
                    {categoryData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        innerRadius={60}
                                        fill="#8884d8"
                                        dataKey="value"
                                        paddingAngle={2}
                                        stroke="#1e293b"
                                        strokeWidth={2}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomPieTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="chart-legend">
                                {categoryData.map((entry, index) => (
                                    <div key={index} className="legend-item">
                                        <div className="legend-indicator" style={{ backgroundColor: entry.color }}></div>
                                        <span className="legend-icon">{entry.icon}</span>
                                        <span className="legend-label">{entry.name}</span>
                                        <span className="legend-value">{formatCurrency(entry.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="chart-empty">
                            <p>No expense data available</p>
                        </div>
                    )}
                </Card>

                {/* Payment Type Breakdown */}
                <Card className="chart-card">
                    <h3 className="chart-title">💳 Payment Method Breakdown</h3>
                    {paymentTypeData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={paymentTypeData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        innerRadius={60}
                                        fill="#8884d8"
                                        dataKey="value"
                                        paddingAngle={2}
                                        stroke="#1e293b"
                                        strokeWidth={2}
                                    >
                                        {paymentTypeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="chart-legend">
                                {paymentTypeData.map((entry, index) => (
                                    <div key={index} className="legend-item">
                                        <div className="legend-indicator" style={{ backgroundColor: entry.color }}></div>
                                        <span className="legend-label">{entry.name}</span>
                                        <span className="legend-value">{formatCurrency(entry.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="chart-empty">
                            <p>No payment method data available</p>
                        </div>
                    )}
                </Card>

                {/* Budget Utilization */}
                <Card className="chart-card">
                    <h3 className="chart-title">💰 Budget Utilization</h3>
                    {budgetUtilizationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={budgetUtilizationData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis
                                    dataKey="month"
                                    stroke="var(--text-secondary)"
                                    style={{ fontSize: '0.75rem' }}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    style={{ fontSize: '0.75rem' }}
                                    tickFormatter={(value) => formatCurrency(value)}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.875rem'
                                    }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Legend />
                                <Bar dataKey="budget" fill="var(--primary)" name="Budget" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="spent" fill="var(--secondary)" name="Spent" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="chart-empty">No budget data available</p>
                    )}
                </Card>

                {/* Income Tracking */}
                <Card className="chart-card">
                    <h3 className="chart-title">💵 Income Tracking</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={incomeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                            <YAxis
                                stroke="var(--text-secondary)"
                                style={{ fontSize: '0.75rem' }}
                                tickFormatter={(value) => formatCurrency(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="income"
                                stroke="var(--success)"
                                strokeWidth={2}
                                dot={{ fill: 'var(--success)', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
