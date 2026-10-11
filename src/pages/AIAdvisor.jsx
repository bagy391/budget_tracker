import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { prepareFinancialContext } from '../utils/aiDataPrep';
import {
    askGeminiAdvisor,
    calculateTrendCards,
    getGeminiApiKey,
    getGeminiModel
} from '../utils/geminiService';
import QuickPromptChips from '../components/ai/QuickPromptChips';
import MarkdownView from '../components/ai/MarkdownView';
import ApiKeyModal from '../components/ai/ApiKeyModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import {
    Sparkles,
    User,
    Users,
    Key,
    TrendingUp,
    TrendingDown,
    Flame,
    Shield,
    Wallet,
    AlertCircle,
    Lightbulb,
    Send,
    RotateCcw,
    Copy,
    Check,
    Settings,
    MessageSquare,
    ExternalLink,
    Gem,
    BarChart2,
    ChevronDown,
    ChevronUp,
    Maximize2,
    Minimize2
} from 'lucide-react';
import './AIAdvisor.css';

const AIAdvisor = () => {
    const { user } = useAuth();
    const {
        expenses,
        incomes,
        budgets,
        categories,
        paymentMethods,
        wealthAssets = [],
        currentFamily,
        loading: budgetLoading
    } = useBudget();

    // Wealth scope: 'personal' (user-owned assets) vs 'family' (entire household portfolio). Cashflow is always unified family.
    const [scope, setScope] = useState('personal');
    const [messages, setMessages] = useState([]);
    const [inputVal, setInputVal] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [agentStatus, setAgentStatus] = useState('');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const chatEndRef = useRef(null);

    // Check if API key is configured
    const apiKey = useMemo(() => getGeminiApiKey(user?.id), [user?.id, showKeyModal]);
    const currentModel = useMemo(() => getGeminiModel(), [showKeyModal]);

    // Prepare live financial data context
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

    // Calculate executive trend highlights
    const trendCards = useMemo(() => {
        return calculateTrendCards(financialContext);
    }, [financialContext]);

    // Initial greeting when scope changes or component loads
    useEffect(() => {
        const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';
        const greeting = scope === 'personal'
            ? `Hello **${userName}**! I'm your AI Financial & Wealth Advisor.\n\n📊 **Cashflow (Unified Family)**: All incomes and expenses across the whole household are tracked together for ${financialContext.currentMonthLabel}.\n💎 **Wealth Scope (Personal)**: I am currently analyzing your **Personal Wealth Portfolio** (assets you personally own). Ask me about your individual investments, personal net worth, asset allocation, or family cashflow!`
            : `Hello **${userName}**! I'm in **Family Wealth Mode**.\n\n📊 **Cashflow (Unified Family)**: Household incomes, expenses, and budgets across **${currentFamily?.name || 'the family'}**.\n👥 **Wealth Scope (Family)**: Analyzing your **Combined Family Wealth Portfolio** across all members. Ask me about total household net worth, shared investments, asset class distribution, or family spending trends!`;

        setMessages([
            {
                id: 'init-msg',
                sender: 'assistant',
                text: greeting,
                suggestedQuestions: scope === 'personal'
                    ? [
                        'Analyze my Personal Wealth portfolio and net worth',
                        'How is my personal portfolio allocated across asset classes?',
                        'Show our household income and expense summary',
                        'Are we on track with our household monthly budget?'
                    ]
                    : [
                        'Analyze our total Family Wealth portfolio & combined net worth',
                        'What is our family net worth, invested total, and returns?',
                        'Compare family spending this month vs previous month',
                        'Which household categories exceeded budget limits?'
                    ],
                timestamp: new Date()
            }
        ]);
    }, [scope, user, currentFamily, financialContext.currentMonthLabel]);

    // Auto-scroll chat only when new messages are added or generating (never on initial mount)
    useEffect(() => {
        if (messages.length > 1 || isGenerating) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isGenerating]);

    // Handle Escape key & body overflow when chat is expanded to full screen
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false);
            }
        };
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isExpanded]);

    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || inputVal).trim();
        if (!query || isGenerating) return;

        // Verify key
        if (!apiKey) {
            setShowKeyModal(true);
            return;
        }

        const userMsg = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: query,
            timestamp: new Date()
        };

        const updatedHistory = [...messages, userMsg];
        setMessages(updatedHistory);
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
                conversationHistory: updatedHistory,
                scope,
                userId: user?.id,
                model: currentModel,
                onStatusUpdate: (msg) => setAgentStatus(msg)
            });

            const aiMsg = {
                id: `ai-${Date.now()}`,
                sender: 'assistant',
                text: response.replyText,
                suggestedQuestions: response.suggestedQuestions,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            let errorText = 'Sorry, an unexpected error occurred while processing your request.';

            if (error.message === 'MISSING_API_KEY') {
                errorText = 'Please provide your Google Gemini API key to activate AI responses.';
                setShowKeyModal(true);
            } else if (error.message === 'INVALID_API_KEY') {
                errorText = 'Your Gemini API key appears invalid or expired. Please check your key in settings.';
                setShowKeyModal(true);
            } else if (error.message === 'RATE_LIMIT_EXCEEDED') {
                errorText = 'Gemini API quota or rate limit reached. Please wait a moment and try again.';
            } else if (error.message) {
                errorText = `Error from Gemini: ${error.message}`;
            }

            setMessages(prev => [
                ...prev,
                {
                    id: `ai-err-${Date.now()}`,
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

    const handleClearChat = () => {
        setMessages([
            {
                id: `reset-${Date.now()}`,
                sender: 'assistant',
                text: 'Chat cleared. Ask me any question about your spending trends, portfolio, or budget!',
                suggestedQuestions: scope === 'personal'
                    ? [
                        'Analyze my Personal Wealth portfolio and net worth',
                        'How is my personal portfolio allocated across asset classes?',
                        'Show our household income and expense summary',
                        'Are we on track with our household monthly budget?'
                    ]
                    : [
                        'Analyze our total Family Wealth portfolio & combined net worth',
                        'What is our family net worth, invested total, and returns?',
                        'Compare family spending this month vs previous month',
                        'Which household categories exceeded budget limits?'
                    ],
                timestamp: new Date()
            }
        ]);
    };

    if (budgetLoading) {
        return <LoadingSpinner fullScreen />;
    }

    const renderCardIcon = (iconName, status) => {
        const size = 18;
        switch (iconName) {
            case 'Gem': return <Gem size={size} />;
            case 'Flame': return <Flame size={size} />;
            case 'TrendingUp': return <TrendingUp size={size} />;
            case 'TrendingDown': return <TrendingDown size={size} />;
            case 'Shield': return <Shield size={size} />;
            case 'Wallet': return <Wallet size={size} />;
            case 'AlertCircle': return <AlertCircle size={size} />;
            default: return <Lightbulb size={size} />;
        }
    };

    return (
        <div className="ai-advisor-page">
            {/* Top Page Header */}
            <header className="ai-page-header">
                <div className="ai-header-brand">
                    <div className="ai-brand-avatar">
                        <Sparkles size={20} className="ai-sparkle-glow" />
                    </div>
                    <div className="ai-brand-titles">
                        <h1 className="ai-brand-heading">AI Financial & Wealth Advisor</h1>
                        <div className="ai-brand-sub">
                            <span className="ai-brand-badge">Family Cashflow</span>
                            <span>• {scope === 'personal' ? 'Personal Wealth' : 'Family Wealth'}</span>
                            <span className="hide-on-compact">• {financialContext.currentMonthLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="ai-header-actions">
                    {/* Scope Toggle: Personal vs Family Wealth */}
                    <div className="ai-scope-pill">
                        <button
                            type="button"
                            className={`ai-scope-btn ${scope === 'personal' ? 'active' : ''}`}
                            onClick={() => setScope('personal')}
                            title="Personal Wealth Portfolio (Your Assets)"
                        >
                            <Gem size={13} />
                            <span>Personal</span>
                        </button>
                        <button
                            type="button"
                            className={`ai-scope-btn ${scope === 'family' ? 'active' : ''}`}
                            onClick={() => setScope('family')}
                            title="Joint Family Wealth Portfolio (All Members)"
                        >
                            <Users size={13} />
                            <span>Family</span>
                        </button>
                    </div>

                    {/* API Key Modal Button */}
                    <button
                        type="button"
                        className={`ai-key-action-btn ${apiKey ? 'configured' : ''}`}
                        onClick={() => setShowKeyModal(true)}
                        title="Configure Gemini API Key"
                    >
                        <Key size={14} />
                        <span>{apiKey ? 'Active' : 'Key'}</span>
                    </button>
                </div>
            </header>

            {/* Missing Key Notification Banner */}
            {!apiKey && (
                <div className="missing-key-banner">
                    <div className="missing-key-content">
                        <div className="missing-key-icon">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div className="missing-key-title">Activate Google Gemini AI Analysis</div>
                            <div className="missing-key-desc">
                                Connect your free Gemini API key from Google AI Studio to unlock live conversational trends & custom budgeting insights.
                            </div>
                        </div>
                    </div>
                    <Button variant="primary" size="small" onClick={() => setShowKeyModal(true)}>
                        <Key size={14} /> Configure Key
                    </Button>
                </div>
            )}

            {/* Executive Highlights Cards (Always visible on page) */}
            <div className="ai-trends-grid">
                {trendCards.map((card, idx) => (
                    <div key={idx} className="trend-card">
                        <div className="trend-card-top">
                            <span className="trend-card-label">{card.title}</span>
                            <div className={`trend-card-icon-pill ${card.status}`}>
                                {renderCardIcon(card.icon, card.status)}
                            </div>
                        </div>
                        <div className="trend-card-body">
                            <div className="trend-card-headline">{card.headline}</div>
                            <div className="trend-card-desc">{card.description}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dynamic Chat Section (with Expand/Collapse full-screen toggle) */}
            <section className={`ai-chat-section ${isExpanded ? 'expanded' : ''}`}>
                <div className="ai-chat-section-header">
                    <div className="ai-chat-header-info">
                        <div className="ai-header-avatar">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <h2 className="ai-chat-title">
                                {scope === 'personal'
                                    ? 'Financial & Wealth Advisor (Personal Wealth Portfolio)'
                                    : 'Financial & Wealth Advisor (Family Wealth Portfolio)'}
                            </h2>
                            <p className="ai-chat-subtitle">
                                Cashflow: Unified Family • Model: {currentModel} • {financialContext.currentMonthLabel}
                            </p>
                        </div>
                    </div>

                    <div className="ai-chat-header-actions">
                        <button
                            type="button"
                            className={`ai-chat-expand-btn ${isExpanded ? 'active' : ''}`}
                            onClick={() => setIsExpanded(prev => !prev)}
                            title={isExpanded ? "Collapse to in-page chat" : "Expand chat to full screen"}
                            aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
                        >
                            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                        </button>

                        <button
                            type="button"
                            className="ai-clear-btn"
                            onClick={handleClearChat}
                            title="Clear conversation"
                        >
                            <RotateCcw size={14} />
                            <span>Clear Chat</span>
                        </button>
                    </div>
                </div>

                {/* Messages Container */}
                <div className="ai-chat-messages">
                    {/* Prompt Starters (only shown when no messages exist) */}
                    {messages.length === 0 && (
                        <div className="ai-empty-starters-card">
                            <div className="empty-starters-avatar">
                                <Sparkles size={28} />
                            </div>
                            <h3>How can I help with your finances?</h3>
                            <p>Ask anything about your personal wealth, household cashflow, or monthly budget.</p>
                            <QuickPromptChips
                                onSelectPrompt={handleSendMessage}
                                scope={scope}
                                disabled={isGenerating}
                            />
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isUser = msg.sender === 'user';
                        return (
                            <div key={msg.id} className={`chat-bubble-row ${isUser ? 'user' : 'assistant'}`}>
                                {!isUser && (
                                    <div className="chat-avatar ai-av">
                                        <Sparkles size={16} />
                                    </div>
                                )}
                                <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                                    <MarkdownView content={msg.text} />

                                    {/* Action buttons (Copy) */}
                                    {!isUser && (
                                        <div className="chat-bubble-actions">
                                            <button
                                                type="button"
                                                className="chat-action-btn"
                                                onClick={() => handleCopy(msg.id, msg.text)}
                                            >
                                                {copiedId === msg.id ? (
                                                    <>
                                                        <Check size={12} color="#81C784" /> Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={12} /> Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Suggested questions follow-up chips */}
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
                                {isUser && (
                                    <div className="chat-avatar user-av">
                                        <User size={16} />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Thinking animation indicator */}
                    {isGenerating && (
                        <div className="chat-bubble-row assistant">
                            <div className="chat-avatar ai-av">
                                <Sparkles size={16} />
                            </div>
                            <div className="chat-bubble assistant">
                                <div className="chat-thinking">
                                    <span>{agentStatus || 'Analyzing financial ledger'}</span>
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

                {/* Bottom Input Bar */}
                <div className="ai-chat-input-bar">
                    <form
                        className="ai-input-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                    >
                        <input
                            type="text"
                            className="ai-chat-input"
                            placeholder={
                                scope === 'personal'
                                    ? "Ask about personal investments, portfolio ROI, net worth, or family spending..."
                                    : "Ask about family wealth, total net worth, asset distribution, or family budgets..."
                            }
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            disabled={isGenerating}
                        />
                        <button
                            type="submit"
                            className="ai-chat-send-btn"
                            disabled={!inputVal.trim() || isGenerating}
                            aria-label="Send question"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </section>

            {/* API Key Modal */}
            <ApiKeyModal
                isOpen={showKeyModal}
                onClose={() => setShowKeyModal(false)}
                userId={user?.id}
                onKeySaved={() => {}}
            />
        </div>
    );
};

export default AIAdvisor;
