import React from 'react';
import { TrendingUp, PieChart, AlertCircle, Lightbulb, RefreshCw, Wallet, Users, Gem, Landmark } from 'lucide-react';
import './QuickPromptChips.css';

const DEFAULT_PERSONAL_PROMPTS = [
    { text: 'Analyze my Personal Wealth portfolio and net worth', icon: <Gem size={14} /> },
    { text: 'How is my personal portfolio allocated across asset classes?', icon: <PieChart size={14} /> },
    { text: 'What is my personal invested capital vs unrealized gains?', icon: <TrendingUp size={14} /> },
    { text: 'Show our household income and expense summary', icon: <Wallet size={14} /> },
    { text: 'Are we on track with our household monthly budget?', icon: <AlertCircle size={14} /> },
    { text: 'List all recurring subscriptions and regular bills', icon: <RefreshCw size={14} /> }
];

const DEFAULT_FAMILY_PROMPTS = [
    { text: 'Analyze our total Family Wealth portfolio & combined net worth', icon: <Gem size={14} /> },
    { text: 'What is our family net worth, invested total, and returns?', icon: <Landmark size={14} /> },
    { text: 'How is our family wealth distributed across asset classes?', icon: <PieChart size={14} /> },
    { text: 'Who spent the most money in the family this month?', icon: <Users size={14} /> },
    { text: 'Compare family spending this month vs previous month', icon: <TrendingUp size={14} /> },
    { text: 'Which household categories exceeded budget limits?', icon: <AlertCircle size={14} /> }
];

const QuickPromptChips = ({ onSelectPrompt, scope = 'personal', disabled = false, customPrompts = null }) => {
    const prompts = customPrompts || (scope === 'personal' ? DEFAULT_PERSONAL_PROMPTS : DEFAULT_FAMILY_PROMPTS);

    return (
        <div className="prompt-chips-container">
            {prompts.map((p, idx) => {
                const text = typeof p === 'string' ? p : p.text;
                const icon = typeof p === 'object' && p.icon ? p.icon : <Lightbulb size={14} />;

                return (
                    <button
                        key={idx}
                        type="button"
                        className="prompt-chip"
                        disabled={disabled}
                        onClick={() => onSelectPrompt(text)}
                    >
                        <span className="prompt-chip-icon">{icon}</span>
                        <span>{text}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default QuickPromptChips;
