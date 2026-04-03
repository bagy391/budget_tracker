import React, { useState } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { format } from 'date-fns';
import { FileText, DollarSign, FolderOpen, CreditCard, Calendar, FileType, AlertTriangle, Trash2 } from 'lucide-react';
import './Forms.css';

const ExpenseForm = ({ expense, onClose }) => {
    const { categories, paymentMethods, addExpense, updateExpense, deleteExpense } = useBudget();

    const [formData, setFormData] = useState({
        title: expense?.title || '',
        amount: expense?.amount || '',
        description: expense?.description || '',
        category_id: expense?.category_id || '',
        payment_method_id: expense?.payment_method_id || '',
        exclude_from_budget: expense?.exclude_from_budget || false,
        transaction_date: expense?.transaction_date
            ? format(new Date(expense.transaction_date), "yyyy-MM-dd'T'HH:mm")
            : format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!formData.title || !formData.amount) {
                throw new Error('Please fill in all required fields');
            }

            if (!formData.category_id) {
                throw new Error('Please select a category');
            }

            if (!formData.payment_method_id) {
                throw new Error('Please select a payment method');
            }

            const data = {
                ...formData,
                amount: parseFloat(formData.amount)
            };

            if (expense) {
                await updateExpense(expense.id, data);
            } else {
                await addExpense(data);
            }

            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        setLoading(true);
        try {
            await deleteExpense(expense.id);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to delete expense');
            setLoading(false);
        }
    };

    const expenseCategories = categories.filter(c => c.type === 'expense');
    const categoryOptions = expenseCategories.map(c => ({
        value: c.id,
        label: c.name,
        icon: undefined // Handled by standard drop down or custom if we want later, we don't need dynamic icons inside the standard select
    }));

    const paymentOptions = paymentMethods.map(pm => ({
        value: pm.id,
        label: pm.name
    }));

    return (
        <form onSubmit={handleSubmit} className="form">
            {error && (
                <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            <Input
                label="Title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Groceries"
                icon={<FileText size={18} />}
                required
            />

            <Input
                label="Amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
                icon={<DollarSign size={18} />}
                required
            />

            <Select
                label="Category"
                value={formData.category_id}
                onChange={(value) => handleChange('category_id', value)}
                options={categoryOptions}
                placeholder="Select category"
                icon={<FolderOpen size={18} />}
                required
            />

            <Select
                label="Payment Method"
                value={formData.payment_method_id}
                onChange={(value) => handleChange('payment_method_id', value)}
                options={paymentOptions}
                placeholder="Select payment method"
                icon={<CreditCard size={18} />}
                required
            />

            <Input
                label="Date & Time"
                type="datetime-local"
                value={formData.transaction_date}
                onChange={(e) => handleChange('transaction_date', e.target.value)}
                icon={<Calendar size={18} />}
            />

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                <input
                    type="checkbox"
                    id="exclude_from_budget"
                    checked={formData.exclude_from_budget}
                    onChange={(e) => handleChange('exclude_from_budget', e.target.checked)}
                    style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="exclude_from_budget" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    Exclude from Budget Calculations
                </label>
            </div>

            <Input
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Optional notes..."
                icon={<FileType size={18} />}
            />

            <div className="form-actions">
                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={loading}
                >
                    {expense ? 'Update Expense' : 'Add Expense'}
                </Button>

                {expense && (
                    <Button
                        type="button"
                        variant="danger"
                        fullWidth
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Trash2 size={16} /> Delete Expense
                        </span>
                    </Button>
                )}

                <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={onClose}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
};

export default ExpenseForm;
