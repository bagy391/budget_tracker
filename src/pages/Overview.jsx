import React, { useState, useEffect } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency, formatDate, calculateBudgetStats } from '../utils/calculations';
import { startOfMonth, endOfMonth, parseISO, endOfDay } from 'date-fns';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import ExpenseForm from '../components/forms/ExpenseForm';
import IncomeForm from '../components/forms/IncomeForm';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Users, Banknote, Plus, TrendingUp, TrendingDown, Wallet, Inbox, Package, CircleDollarSign, Activity } from 'lucide-react';
import DynamicIcon from '../components/common/DynamicIcon';
import './Overview.css';

const Overview = () => {
    const { expenses, incomes, budgets, loading, currentFamily } = useBudget();
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [editingIncome, setEditingIncome] = useState(null);

    if (!currentFamily) {
        return (
            <div className="overview">
                <h1 className="overview-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={28} color="var(--primary)" /> Overview
                </h1>
                <Card>
                    <div className="empty-state">
                        <Users size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                        <p className="empty-text">No Family Selected</p>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>
                            Create or select a family from Settings to start tracking your budget
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    // Get current month budget
    const currentMonth = new Date();
    const currentBudget = budgets.find(budget => {
        const budgetStart = parseISO(budget.start_date);
        const budgetEnd = endOfDay(parseISO(budget.end_date));
        return currentMonth >= budgetStart && currentMonth <= budgetEnd;
    });

    const budgetStats = calculateBudgetStats(currentBudget, expenses);

    // Get recent transactions (combine expenses and incomes)
    const recentExpenses = expenses.slice(0, 5);
    const recentIncomes = incomes.slice(0, 2);

    // Calculate monthly totals
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthlyExpenses = expenses.filter(e => {
        const date = parseISO(e.transaction_date);
        return date >= monthStart && date <= monthEnd;
    });

    const monthlyIncomes = incomes.filter(i => {
        const date = parseISO(i.date);
        return date >= monthStart && date <= monthEnd;
    });

    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalIncome = monthlyIncomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);

    const handleEditExpense = (expense) => {
        setEditingExpense(expense);
        setShowExpenseModal(true);
    };

    const handleEditIncome = (income) => {
        setEditingIncome(income);
        setShowIncomeModal(true);
    };

    const handleCloseExpenseModal = () => {
        setShowExpenseModal(false);
        setEditingExpense(null);
    };

    const handleCloseIncomeModal = () => {
        setShowIncomeModal(false);
        setEditingIncome(null);
    };

    return (
        <div className="overview">
            <div className="overview-header">
                <div>
                    <h1 className="overview-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={28} color="var(--primary)" /> Overview
                    </h1>
                    <p className="overview-subtitle">{currentFamily.name}</p>
                </div>
            </div>

            <div className="fab-container" style={{ position: 'fixed', bottom: 'calc(90px + var(--space-lg))', right: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end', zIndex: 90 }}>
                <button 
                  className="fab fab-secondary"
                  style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--surface-variant)', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}
                  onClick={() => setShowIncomeModal(true)}
                  title="Add Income"
                >
                    <Banknote size={24} />
                </button>
                <button 
                  className="fab"
                  style={{ position: 'static', width: '64px', height: '64px', borderRadius: '16px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-lg)' }}
                  onClick={() => setShowExpenseModal(true)}
                  title="Add Expense"
                >
                    <Plus size={32} />
                </button>
            </div>

            <div className="overview-stats">
                <Card className="stat-card stat-card--income">
                    <div className="stat-icon" style={{ display: 'flex', alignItems: 'center' }}><TrendingUp size={28} color="var(--success)" /></div>
                    <div className="stat-content">
                        <p className="stat-label">Total Income</p>
                        <h3 className="stat-value">{formatCurrency(totalIncome)}</h3>
                    </div>
                </Card>

                <Card className="stat-card stat-card--expense">
                    <div className="stat-icon" style={{ display: 'flex', alignItems: 'center' }}><TrendingDown size={28} color="var(--error)" /></div>
                    <div className="stat-content">
                        <p className="stat-label">Total Expenses</p>
                        <h3 className="stat-value">{formatCurrency(totalExpenses)}</h3>
                    </div>
                </Card>

                {currentBudget && (
                    <Card className="stat-card stat-card--budget">
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center' }}><Wallet size={28} color="var(--primary)" /></div>
                        <div className="stat-content">
                            <p className="stat-label">Budget Remaining</p>
                            <h3 className="stat-value">{formatCurrency(budgetStats.remaining)}</h3>
                            <p className="stat-detail">{budgetStats.percentage.toFixed(0)}% used</p>
                        </div>
                    </Card>
                )}
            </div>

            <div className="overview-section">
                <h2 className="section-title">Recent Transactions</h2>

                {recentExpenses.length === 0 && recentIncomes.length === 0 ? (
                    <Card>
                        <div className="empty-state">
                            <Inbox size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                            <p className="empty-text">No transactions yet</p>
                            <p className="empty-subtext">Add your first expense or income to get started</p>
                        </div>
                    </Card>
                ) : (
                    <div className="transactions-list">
                        {recentExpenses.map(expense => (
                            <Card
                                key={expense.id}
                                className="transaction-card"
                                onClick={() => handleEditExpense(expense)}
                                hover
                            >
                                <div className="transaction-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DynamicIcon name={expense.categories?.icon || 'Package'} size={24} />
                                </div>
                                <div className="transaction-details">
                                    <h4 className="transaction-title">{expense.title}</h4>
                                    <p className="transaction-meta">
                                        {expense.categories?.name || 'Uncategorized'} • {formatDate(expense.transaction_date)}
                                    </p>
                                </div>
                                <div className="transaction-amount transaction-amount--expense">
                                    -{formatCurrency(expense.amount)}
                                </div>
                            </Card>
                        ))}

                        {recentIncomes.map(income => (
                            <Card
                                key={income.id}
                                className="transaction-card"
                                onClick={() => handleEditIncome(income)}
                                hover
                            >
                                <div className="transaction-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CircleDollarSign size={24} color="var(--success)" />
                                </div>
                                <div className="transaction-details">
                                    <h4 className="transaction-title">{income.source}</h4>
                                    <p className="transaction-meta">
                                        Income • {formatDate(income.date)}
                                    </p>
                                </div>
                                <div className="transaction-amount transaction-amount--income">
                                    +{formatCurrency(income.amount)}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <Modal
                isOpen={showExpenseModal}
                onClose={handleCloseExpenseModal}
                title={editingExpense ? 'Edit Expense' : 'Add Expense'}
            >
                <ExpenseForm
                    expense={editingExpense}
                    onClose={handleCloseExpenseModal}
                />
            </Modal>

            <Modal
                isOpen={showIncomeModal}
                onClose={handleCloseIncomeModal}
                title={editingIncome ? 'Edit Income' : 'Add Income'}
            >
                <IncomeForm
                    income={editingIncome}
                    onClose={handleCloseIncomeModal}
                />
            </Modal>
        </div>
    );
};

export default Overview;
