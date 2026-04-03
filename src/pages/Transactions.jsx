import React, { useState, useMemo } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import Card from '../components/common/Card';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ExpenseForm from '../components/forms/ExpenseForm';
import IncomeForm from '../components/forms/IncomeForm';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './Transactions.css';

const Transactions = () => {
    const { expenses, incomes, loading, currentFamily, updateExpense, updateIncome, refreshData } = useBudget();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [editingIncome, setEditingIncome] = useState(null);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showBulkDateModal, setShowBulkDateModal] = useState(false);
    const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [bulkLoading, setBulkLoading] = useState(false);

    // Generate month options (last 12 months)
    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            options.push({
                value: format(date, 'yyyy-MM'),
                label: format(date, 'MMMM yyyy')
            });
        }
        return options;
    }, []);

    // Filter transactions by selected month
    const filteredTransactions = useMemo(() => {
        const monthStart = startOfMonth(parseISO(selectedMonth + '-01'));
        const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'));

        const monthExpenses = expenses
            .filter(e => {
                const date = parseISO(e.transaction_date);
                return date >= monthStart && date <= monthEnd;
            })
            .map(e => ({ ...e, type: 'expense' }));

        const monthIncomes = incomes
            .filter(i => {
                const date = parseISO(i.date);
                return date >= monthStart && date <= monthEnd;
            })
            .map(i => ({ ...i, type: 'income' }));

        const combined = [...monthExpenses, ...monthIncomes].sort((a, b) => {
            const dateA = parseISO(a.transaction_date || a.date);
            const dateB = parseISO(b.transaction_date || b.date);
            return dateB - dateA;
        });

        return combined;
    }, [expenses, incomes, selectedMonth]);

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

    // Bulk selection handlers
    const toggleSelection = (e, id, type) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);
        const key = `${type}-${id}`;
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedIds(newSelected);
    };



    const handleBulkDateSave = async () => {
        setBulkLoading(true);
        try {
            const updates = Array.from(selectedIds).map(async (key) => {
                const type = key.startsWith('expense-') ? 'expense' : 'income';
                const id = key.substring(type.length + 1); // remove 'expense-' or 'income-'
                
                if (type === 'expense') {
                    // Update expense date with approximated time to avoid zone resets
                    const newDate = new Date(bulkDate + 'T12:00:00').toISOString();
                    await updateExpense(id, { transaction_date: newDate });
                } else {
                    // Update income date
                    await updateIncome(id, { date: bulkDate });
                }
            });
            await Promise.all(updates);
            
            refreshData();

            setShowBulkDateModal(false);
            setSelectedIds(new Set());
        } catch (err) {
            console.error('Failed to bulk update:', err);
            alert('Failed to update transactions');
        } finally {
            setBulkLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    // No family selected
    if (!currentFamily) {
        return (
            <div className="transactions">
                <h1 className="transactions-title">Transactions</h1>
                <Card>
                    <div className="empty-state">
                        <p className="empty-icon">👨‍👩‍👧‍👦</p>
                        <p className="empty-text">No Family Selected</p>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>
                            Create or select a family from Settings to view transactions
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    const totalExpenses = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalIncome = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return (
        <div className="transactions">
            <div className="transactions-header">
                <h1 className="transactions-title">Transactions</h1>
                <Select
                    value={selectedMonth}
                    onChange={(val) => {
                        setSelectedMonth(val);
                        setSelectedIds(new Set()); // Reset selection on month change
                    }}
                    options={monthOptions}
                    icon="📅"
                />
            </div>

            <div className="transactions-summary">
                <Card className="summary-card summary-card--income">
                    <p className="summary-label">Income</p>
                    <h3 className="summary-value">{formatCurrency(totalIncome)}</h3>
                </Card>
                <Card className="summary-card summary-card--expense">
                    <p className="summary-label">Expenses</p>
                    <h3 className="summary-value">{formatCurrency(totalExpenses)}</h3>
                </Card>
                <Card className="summary-card summary-card--net">
                    <p className="summary-label">Net</p>
                    <h3 className={`summary-value ${totalIncome - totalExpenses >= 0 ? 'summary-value--positive' : 'summary-value--negative'}`}>
                        {formatCurrency(totalIncome - totalExpenses)}
                    </h3>
                </Card>
            </div>

            <div className="transactions-list">
                {filteredTransactions.length > 0 && (
                    <div className="transactions-bulk-actions">
                        <div className="bulk-selection">
                            <span className="bulk-selection-label">
                                {selectedIds.size} Selected
                            </span>
                        </div>
                        {selectedIds.size > 0 && (
                            <Button variant="primary" size="sm" onClick={() => setShowBulkDateModal(true)}>
                                Change Date
                            </Button>
                        )}
                    </div>
                )}

                {filteredTransactions.length === 0 ? (
                    <Card>
                        <div className="empty-state">
                            <p className="empty-icon">📭</p>
                            <p className="empty-text">No transactions this month</p>
                        </div>
                    </Card>
                ) : (
                    filteredTransactions.map(transaction => {
                        const isExpense = transaction.type === 'expense';
                        const key = `${transaction.type}-${transaction.id}`;
                        const isSelected = selectedIds.has(key);
                        
                        return (
                            <Card
                                key={key}
                                className={`transaction-card ${isSelected ? 'transaction-card--selected' : ''}`}
                                onClick={() => isExpense ? handleEditExpense(transaction) : handleEditIncome(transaction)}
                                hover
                            >
                                <div className="transaction-checkbox" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => toggleSelection(e, transaction.id, transaction.type)}
                                        className="transaction-checkbox-input"
                                    />
                                </div>
                                <div className="transaction-icon">
                                    {isExpense ? (transaction.categories?.icon || '📦') : '💰'}
                                </div>
                                <div className="transaction-details">
                                    <h4 className="transaction-title">
                                        {isExpense ? transaction.title : transaction.source}
                                    </h4>
                                    <p className="transaction-meta">
                                        {isExpense && transaction.categories?.name && `${transaction.categories.name} • `}
                                        {formatDate(transaction.transaction_date || transaction.date)}
                                        {isExpense && transaction.payment_methods?.name && ` • ${transaction.payment_methods.name}`}
                                    </p>
                                </div>
                                <div className={`transaction-amount ${isExpense ? 'transaction-amount--expense' : 'transaction-amount--income'}`}>
                                    {isExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
                                </div>
                            </Card>
                        );
                    })
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

            <Modal
                isOpen={showBulkDateModal}
                onClose={() => setShowBulkDateModal(false)}
                title="Change Date"
            >
                <div style={{ padding: '1rem' }}>
                    <Input
                        label="New Date for Selected Transactions"
                        type="date"
                        value={bulkDate}
                        onChange={(e) => setBulkDate(e.target.value)}
                        icon="📅"
                    />
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                        <Button variant="ghost" onClick={() => setShowBulkDateModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={bulkLoading} onClick={handleBulkDateSave}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Transactions;
