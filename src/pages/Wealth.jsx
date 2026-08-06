import React from 'react';
import { useBudget } from '../contexts/BudgetContext';
import WealthList from '../components/wealth/WealthList';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { TrendingUp, Users } from 'lucide-react';

const Wealth = () => {
    const { loading, currentFamily } = useBudget();

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="wealth-page">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', marginBottom: 'var(--space-xl)' }}>
                <TrendingUp size={28} color="var(--primary)" /> Wealth
            </h1>

            {!currentFamily ? (
                <Card>
                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                        <Users size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                        <h2>No Family Selected</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Please create or select a family from Settings to manage wealth assets.
                        </p>
                    </div>
                </Card>
            ) : (
                <WealthList />
            )}
        </div>
    );
};

export default Wealth;
