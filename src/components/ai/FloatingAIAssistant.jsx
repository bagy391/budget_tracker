import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBudget } from '../../contexts/BudgetContext';
import { useAuth } from '../../contexts/AuthContext';
import { prepareFinancialContext } from '../../utils/aiDataPrep';
import { askGeminiAdvisor, getGeminiApiKey, getGeminiModel } from '../../utils/geminiService';
import MarkdownView from './MarkdownView';
import ApiKeyModal from './ApiKeyModal';
import {
    Sparkles,
    X,
    Maximize2,
    Send,
    User,
    Users,
    RotateCcw,
    Copy,
    Check,
    Gem
} from 'lucide-react';
import './FloatingAIAssistant.css';

const QUICK_FLOATING_PROMPTS = [
    'Analyze my wealth portfolio and net worth',
    'Quick summary of our family spending this month',
    'What is our family monthly income and savings rate?',
    'Are any family budget categories exceeded?'
];

const FloatingAIAssistant = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        expenses,
        incomes,
        budgets,
        categories,
        paymentMethods,
        wealthAssets = [],
        currentFamily
    } = useBudget();

    const [isOpen, setIsOpen] = useState(false);
    const [scope, setScope] = useState('personal');
    const [messages, setMessages] = useState([]);
    const [inputVal, setInputVal] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [agentStatus, setAgentStatus] = useState('');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    const chatEndRef = useRef(null);

    // If on the full-page AI Advisor, do not render floating widget to avoid duplication
    const isOnAdvisorPage = location.pathname === '/ai-advisor';

    const apiKey = useMemo(() => getGeminiApiKey(user?.id), [user?.id, showKeyModal]);
    const currentModel = useMemo(() => getGeminiModel(), [showKeyModal]);

    // Financial context
    const financialContext = useMemo(() => {
        return prepareFinancialContext({
            expenses,
            incomes,
            budgets,
            categories,
            paymentMethods,
            wealthAssets,
            currentFamily,
            currentUser: user,
            scope,
            targetDate: new Date()
        });
    }, [expenses, incomes, budgets, categories, paymentMethods, wealthAssets, currentFamily, user, scope]);

    // Initialize greeting on open or scope change
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';
            const greeting = scope === 'personal'
                ? `Hi **${userName}**! Incomes and expenses are unified across the family for ${financialContext.currentMonthLabel}. I am currently analyzing your **Personal Wealth Portfolio** (assets you personally own). Ask me anything!`
                : `Hi **${userName}**! Analyzing your **Family Wealth Portfolio** and unified household cashflow for ${financialContext.currentMonthLabel}. Ask me anything!`;
            setMessages([
                {
                    id: 'drawer-init',
                    sender: 'assistant',
                    text: greeting,
                    timestamp: new Date()
                }
            ]);
        }
    }, [isOpen, scope, user, messages.length, financialContext.currentMonthLabel]);

    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isGenerating, isOpen]);

    if (isOnAdvisorPage) return null;

    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || inputVal).trim();
        if (!query || isGenerating) return;

        if (!apiKey) {
            setShowKeyModal(true);
            return;
        }

        const userMsg = {
            id: `drawer-user-${Date.now()}`,
            sender: 'user',
            text: query,
            timestamp: new Date()
        };

        const updated = [...messages, userMsg];
        setMessages(updated);
        setInputVal('');
        setIsGenerating(true);

        try {
            const response = await askGeminiAdvisor({
                question: query,
                financialContext,
                toolContext: {
                    expenses,
                    incomes,
                    budgets,
                    categories,
                    paymentMethods,
                    wealthAssets,
                    currentUser: user,
                    currentFamily,
                    scope
                },
                conversationHistory: updated,
                scope,
                userId: user?.id,
                model: currentModel,
                onStatusUpdate: (msg) => setAgentStatus(msg)
            });

            const aiMsg = {
                id: `drawer-ai-${Date.now()}`,
                sender: 'assistant',
                text: response.replyText,
                suggestedQuestions: response.suggestedQuestions,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            let errorText = 'An error occurred while answering.';
            if (error.message === 'MISSING_API_KEY' || error.message === 'INVALID_API_KEY') {
                setShowKeyModal(true);
                errorText = 'Please enter a valid Gemini API key to activate AI responses.';
            } else if (error.message) {
                errorText = error.message;
            }

            setMessages(prev => [
                ...prev,
                {
                    id: `drawer-err-${Date.now()}`,
                    sender: 'assistant',
                    text: `⚠️ **Notice**: ${errorText}`,
                    timestamp: new Date()
                }
            ]);
        } finally {
            setIsGenerating(false);
            setAgentStatus('');
        }
    };

    const handleCopy = (id, text) => {
        navigator.clipboard?.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleOpenFullPage = () => {
        setIsOpen(false);
        navigate('/ai-advisor');
    };

    return (
        <>
            {/* FAB Trigger Button */}
            <div className="floating-ai-fab-container">
                <button
                    type="button"
                    className="floating-ai-fab"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Open AI Financial Assistant"
                    title="Open AI Spending Assistant"
                >
                    <span className="floating-ai-fab-icon">
                        <Sparkles size={18} />
                    </span>
                    <span className="floating-ai-fab-label">AI Advisor</span>
                </button>
            </div>

            {/* Slide-out Drawer */}
            {isOpen && (
                <>
                    <div className="floating-ai-drawer-overlay" onClick={() => setIsOpen(false)} />
                    <div className="floating-ai-drawer" onClick={e => e.stopPropagation()}>
                        {/* Drawer Header */}
                        <div className="floating-drawer-header">
                            <div className="floating-drawer-title-group">
                                <Sparkles size={18} color="var(--primary)" />
                                <span className="floating-drawer-title">AI Financial Advisor</span>
                            </div>
                            <div className="floating-drawer-actions">
                                <button
                                    type="button"
                                    className="drawer-icon-btn"
                                    onClick={handleOpenFullPage}
                                    title="Open Full Page View"
                                >
                                    <Maximize2 size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="drawer-icon-btn"
                                    onClick={() => setMessages([])}
                                    title="Reset Conversation"
                                >
                                    <RotateCcw size={15} />
                                </button>
                                <button
                                    type="button"
                                    className="drawer-icon-btn"
                                    onClick={() => setIsOpen(false)}
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Sub-bar with Scope Switcher */}
                        <div className="floating-drawer-subbar">
                            <div className="drawer-scope-pill">
                                <button
                                    type="button"
                                    className={`drawer-scope-btn ${scope === 'personal' ? 'active' : ''}`}
                                    onClick={() => {
                                        setScope('personal');
                                        setMessages([]);
                                    }}
                                    title="Personal Wealth Portfolio"
                                >
                                    <Gem size={13} />
                                    <span>Personal Wealth</span>
                                </button>
                                <button
                                    type="button"
                                    className={`drawer-scope-btn ${scope === 'family' ? 'active' : ''}`}
                                    onClick={() => {
                                        setScope('family');
                                        setMessages([]);
                                    }}
                                    title="Joint Family Wealth Portfolio"
                                >
                                    <Users size={13} />
                                    <span>Family Wealth</span>
                                </button>
                            </div>
                            <span className="drawer-month-badge">{financialContext.currentMonthLabel}</span>
                        </div>

                        {/* Drawer Messages Stream */}
                        <div className="floating-drawer-messages">
                            {/* Quick Prompts */}
                            {messages.length <= 1 && (
                                <div className="drawer-chips-container">
                                    {QUICK_FLOATING_PROMPTS.map((promptText, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="drawer-chip-btn"
                                            disabled={isGenerating}
                                            onClick={() => handleSendMessage(promptText)}
                                        >
                                            {promptText}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {messages.map((msg) => {
                                const isUser = msg.sender === 'user';
                                return (
                                    <div
                                        key={msg.id}
                                        className={`drawer-bubble-row ${isUser ? 'user' : 'assistant'}`}
                                    >
                                        <div className={`drawer-bubble ${isUser ? 'user' : 'assistant'}`}>
                                            <MarkdownView content={msg.text} />

                                            {!isUser && (
                                                <div style={{ marginTop: '0.4rem', textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="chat-action-btn"
                                                        onClick={() => handleCopy(msg.id, msg.text)}
                                                        style={{ display: 'inline-flex' }}
                                                    >
                                                        {copiedId === msg.id ? (
                                                            <>
                                                                <Check size={11} color="#81C784" /> Copied
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={11} /> Copy
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Suggested follow-up chips */}
                                            {!isUser && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                                                <div className="suggested-chips-wrap">
                                                    {msg.suggestedQuestions.map((q, qIdx) => (
                                                        <button
                                                            key={qIdx}
                                                            type="button"
                                                            className="suggested-chip"
                                                            disabled={isGenerating}
                                                            onClick={() => handleSendMessage(q)}
                                                        >
                                                            {q}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {isGenerating && (
                                <div className="drawer-bubble-row assistant">
                                    <div className="drawer-bubble assistant">
                                        <div className="chat-thinking">
                                            <span>{agentStatus || 'Thinking'}</span>
                                            <span className="thinking-dots">
                                                <span className="thinking-dot"></span>
                                                <span className="thinking-dot"></span>
                                                <span className="thinking-dot"></span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Drawer Input Bar */}
                        <form
                            className="floating-drawer-input-bar"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                        >
                            <input
                                type="text"
                                className="drawer-input"
                                placeholder={
                                    scope === 'personal'
                                        ? "Ask about personal wealth, investments, or family cashflow..."
                                        : "Ask about family wealth, net worth, or household cashflow..."
                                }
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                disabled={isGenerating}
                            />
                            <button
                                type="submit"
                                className="drawer-send-btn"
                                disabled={!inputVal.trim() || isGenerating}
                                aria-label="Send"
                            >
                                <Send size={15} />
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* API Key Modal */}
            <ApiKeyModal
                isOpen={showKeyModal}
                onClose={() => setShowKeyModal(false)}
                userId={user?.id}
                onKeySaved={() => {}}
            />
        </>
    );
};

export default FloatingAIAssistant;
