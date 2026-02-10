import React, { useState, useMemo } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency, calculateBudgetStats } from '../utils/calculations';
import { format, startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './Budget.css';

const Budget = () => {
    const { budgets, expenses, saveBudget, loading, currentFamily } = useBudget();
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Get current month budget
    const currentMonth = new Date();
    const currentBudget = budgets.find(budget => {
        const budgetStart = parseISO(budget.start_date);
        const budgetEnd = parseISO(budget.end_date);
        return currentMonth >= budgetStart && currentMonth <= budgetEnd;
    });

    const stats = calculateBudgetStats(currentBudget, expenses);

    const handleSaveBudget = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const budgetAmount = parseFloat(amount);
            if (isNaN(budgetAmount) || budgetAmount <= 0) {
                throw new Error('Please enter a valid budget amount');
            }

            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            const budgetData = {
                amount: budgetAmount,
                start_date: format(monthStart, 'yyyy-MM-dd'),
                end_date: format(monthEnd, 'yyyy-MM-dd')
            };

            // If current budget exists, include its ID to update
            if (currentBudget) {
                budgetData.id = currentBudget.id;
            }

            await saveBudget(budgetData);
            setAmount('');
        } catch (err) {
            setError(err.message || 'Failed to save budget');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    // No family selected
    if (!currentFamily) {
        return (
            <div className="budget">
                <h1 className="budget-title">Budget</h1>
                <Card>
                    <div className="budget-empty">
                        <div className="budget-empty-icon">👨‍👩‍👧‍👦</div>
                        <h2>No Family Selected</h2>
                        <p>Please create or select a family from Settings to start budgeting</p>
                    </div>
                </Card>
            </div>
        );
    }

    // Calculate progress bar position for current date
    const today = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const totalDays = differenceInDays(monthEnd, monthStart) + 1;
    const daysPassed = differenceInDays(today, monthStart) + 1;
    const currentDayPercentage = (daysPassed / totalDays) * 100;

    // Determine budget health color
    const getHealthColor = () => {
        if (stats.percentage < 50) return 'var(--success)';
        if (stats.percentage < 80) return 'var(--warning)';
        return 'var(--danger)';
    };

    return (
        <div className="budget">
            <h1 className="budget-title">Budget</h1>

            {currentBudget ? (
                <>
                    <Card className="budget-summary">
                        <div className="budget-summary-header">
                            <h2>{format(currentMonth, 'MMMM yyyy')} Budget</h2>
                            <div className="budget-amount-display">{formatCurrency(stats.total)}</div>
                        </div>

                        <div className="budget-progress">
                            <div className="budget-progress-bar">
                                <div
                                    className="budget-progress-fill"
                                    style={{
                                        width: `${stats.percentage}%`,
                                        background: getHealthColor()
                                    }}
                                />
                                <div
                                    className="budget-progress-marker"
                                    style={{ left: `${currentDayPercentage}%` }}
                                    title={`Today - ${format(today, 'MMM dd')}`}
                                >
                                    <div className="budget-progress-marker-line"></div>
                                    <div className="budget-progress-marker-dot"></div>
                                </div>
                            </div>

                            <div className="budget-progress-labels">
                                <span className="budget-progress-label">
                                    Spent: {formatCurrency(stats.spent)}
                                </span>
                                <span className="budget-progress-label">
                                    Remaining: {formatCurrency(stats.remaining)}
                                </span>
                            </div>
                        </div>

                        <div className="budget-stats">
                            <div className="budget-stat">
                                <div className="budget-stat-icon">📊</div>
                                <div>
                                    <p className="budget-stat-label">Used</p>
                                    <h3 className="budget-stat-value">{stats.percentage.toFixed(1)}%</h3>
                                </div>
                            </div>

                            <div className="budget-stat">
                                <div className="budget-stat-icon">💡</div>
                                <div>
                                    <p className="budget-stat-label">Safe to Spend/Day</p>
                                    <h3 className="budget-stat-value">{formatCurrency(stats.safeToSpend)}</h3>
                                    <p className="budget-stat-detail">{stats.daysLeft} days left</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h3>Update Budget</h3>
                        <form onSubmit={handleSaveBudget} className="budget-form">
                            {error && (
                                <div className="form-error">
                                    <span>⚠️</span>
                                    {error}
                                </div>
                            )}

                            <Input
                                label="New Budget Amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Current: ${formatCurrency(stats.total)}`}
                                icon="💰"
                                required
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                loading={saving}
                            >
                                Update Budget
                            </Button>
                        </form>
                    </Card>
                </>
            ) : (
                <Card>
                    <div className="budget-empty">
                        <div className="budget-empty-icon">💰</div>
                        <h2>No Budget Set</h2>
                        <p>Set your budget for {format(currentMonth, 'MMMM yyyy')} to track your spending</p>

                        <form onSubmit={handleSaveBudget} className="budget-form">
                            {error && (
                                <div className="form-error">
                                    <span>⚠️</span>
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Budget Amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount..."
                                icon="💰"
                                required
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                loading={saving}
                            >
                                Set Budget
                            </Button>
                        </form>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default Budget;
