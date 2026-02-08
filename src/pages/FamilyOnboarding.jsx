import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBudget } from '../contexts/BudgetContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import './FamilyOnboarding.css';

const FamilyOnboarding = () => {
    const [selected, setSelected] = useState(null);
    const [familyName, setFamilyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { createFamily, families } = useBudget();
    const navigate = useNavigate();

    // If user already has families, redirect to app
    useEffect(() => {
        if (families && families.length > 0) {
            navigate('/', { replace: true });
        }
    }, [families, navigate]);

    const handleCreateFamily = async () => {
        setError('');
        setLoading(true);

        try {
            const name = selected === 'personal' ? 'Personal Workspace' : familyName.trim();

            if (!name) {
                setError('Please enter a family name');
                setLoading(false);
                return;
            }

            await createFamily(name);
            navigate('/', { replace: true });
        } catch (error) {
            setError(error.message || 'Failed to create family');
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-content">
                <div className="onboarding-header">
                    <h1 className="onboarding-title gradient-text">Welcome! 🎉</h1>
                    <p className="onboarding-subtitle">Let's set up your budget tracking</p>
                </div>

                <div className="onboarding-options">
                    <div
                        className={`onboarding-card ${selected === 'personal' ? 'onboarding-card--selected' : ''}`}
                        onClick={() => setSelected('personal')}
                    >
                        <div className="onboarding-card-icon">👤</div>
                        <h3 className="onboarding-card-title">Personal Workspace</h3>
                        <p className="onboarding-card-description">
                            Track your personal expenses and budgets
                        </p>
                        {selected === 'personal' && (
                            <div className="onboarding-card-check">✓</div>
                        )}
                    </div>

                    <div
                        className={`onboarding-card ${selected === 'family' ? 'onboarding-card--selected' : ''}`}
                        onClick={() => setSelected('family')}
                    >
                        <div className="onboarding-card-icon">👨‍👩‍👧‍👦</div>
                        <h3 className="onboarding-card-title">Create a Family</h3>
                        <p className="onboarding-card-description">
                            Share budgets and expenses with your family
                        </p>
                        {selected === 'family' && (
                            <div className="onboarding-card-check">✓</div>
                        )}
                    </div>
                </div>

                {selected === 'family' && (
                    <div className="onboarding-form">
                        <Input
                            label="Family Name"
                            value={familyName}
                            onChange={(e) => setFamilyName(e.target.value)}
                            placeholder="e.g., Smith Family"
                            icon="👨‍👩‍👧‍👦"
                            required
                        />
                    </div>
                )}

                {error && (
                    <div className="onboarding-error">
                        <span>⚠️</span>
                        {error}
                    </div>
                )}

                {selected && (
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleCreateFamily}
                        loading={loading}
                    >
                        {selected === 'personal' ? 'Create Personal Workspace' : 'Create Family'}
                    </Button>
                )}
            </div>

            <div className="onboarding-decoration">
                <div className="onboarding-blob onboarding-blob-1"></div>
                <div className="onboarding-blob onboarding-blob-2"></div>
                <div className="onboarding-blob onboarding-blob-3"></div>
            </div>
        </div>
    );
};

export default FamilyOnboarding;
