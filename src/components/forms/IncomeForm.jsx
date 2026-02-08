import React, { useState } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Button from '../common/Button';
import Input from '../common/Input';
import { format } from 'date-fns';
import './Forms.css';

const IncomeForm = ({ income, onClose }) => {
    const { addIncome, updateIncome, deleteIncome } = useBudget();

    const [formData, setFormData] = useState({
        source: income?.source || '',
        amount: income?.amount || '',
        date: income?.date
            ? format(new Date(income.date), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd')
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
            if (!formData.source || !formData.amount) {
                throw new Error('Please fill in all required fields');
            }

            const data = {
                ...formData,
                amount: parseFloat(formData.amount)
            };

            if (income) {
                await updateIncome(income.id, data);
            } else {
                await addIncome(data);
            }

            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save income');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this income?')) return;

        setLoading(true);
        try {
            await deleteIncome(income.id);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to delete income');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="form">
            {error && (
                <div className="form-error">
                    <span>⚠️</span>
                    {error}
                </div>
            )}

            <Input
                label="Source"
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
                placeholder="e.g., Salary, Freelance"
                icon="💰"
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

            <Input
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                icon="📅"
            />

            <div className="form-actions">
                <Button
                    type="submit"
                    variant="success"
                    fullWidth
                    loading={loading}
                >
                    {income ? 'Update Income' : 'Add Income'}
                </Button>

                {income && (
                    <Button
                        type="button"
                        variant="danger"
                        fullWidth
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        Delete Income
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

export default IncomeForm;
