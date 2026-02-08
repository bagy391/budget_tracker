import React, { useState } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { format } from 'date-fns';
import './Forms.css';

const ExpenseForm = ({ expense, onClose }) => {
    const { categories, paymentMethods, addExpense, updateExpense, deleteExpense } = useBudget();

    const [formData, setFormData] = useState({
        title: expense?.title || '',
        amount: expense?.amount || '',
        description: expense?.description || '',
        category_id: expense?.category_id || '',
        payment_method_id: expense?.payment_method_id || '',
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
        icon: c.icon
    }));

    const paymentOptions = paymentMethods.map(pm => ({
        value: pm.id,
        label: pm.name
    }));

    return (
        <form onSubmit={handleSubmit} className="form">
            {error && (
                <div className="form-error">
                    <span>⚠️</span>
                    {error}
                </div>
            )}

            <Input
                label="Title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Groceries"
                icon="📝"
                required
            />

            <Input
                label="Amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
                icon="💵"
                required
            />

            <Select
                label="Category"
                value={formData.category_id}
                onChange={(value) => handleChange('category_id', value)}
                options={categoryOptions}
                placeholder="Select category"
                icon="📂"
                required
            />

            <Select
                label="Payment Method"
                value={formData.payment_method_id}
                onChange={(value) => handleChange('payment_method_id', value)}
                options={paymentOptions}
                placeholder="Select payment method"
                icon="💳"
                required
            />

            <Input
                label="Date & Time"
                type="datetime-local"
                value={formData.transaction_date}
                onChange={(e) => handleChange('transaction_date', e.target.value)}
                icon="📅"
            />

            <Input
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Optional notes..."
                icon="📄"
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
                        Delete Expense
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
