import React, { useState, useCallback } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth }   from '../contexts/AuthContext';
import Card    from '../components/common/Card';
import Button  from '../components/common/Button';
import Input   from '../components/common/Input';
import Select  from '../components/common/Select';
import { connectGmail, disconnectGmail, isGmailConnected } from '../utils/gmail/gmailAuth';
import { fetchNewMessages, markProcessed } from '../utils/gmail/gmailClient';
import { parseEmails } from '../utils/gmail/parserEngine';
import {
    Mail, RefreshCw, CheckCircle2, XCircle, Unlink, AlertTriangle,
    Banknote, CreditCard, Wallet, Info, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import './GmailSync.css';

const PAYMENT_TYPE_ICONS = {
    bank:        <Banknote size={14} />,
    credit_card: <CreditCard size={14} />,
    upi:         <Wallet size={14} />,
};

const GmailSync = () => {
    const { user }   = useAuth();
    const { categories, paymentMethods, addExpense, currentFamily } = useBudget();

    const [connected,    setConnected]    = useState(isGmailConnected());
    const [connecting,   setConnecting]   = useState(false);
    const [daysBack,     setDaysBack]     = useState('10');
    const [syncing,      setSyncing]      = useState(false);
    const [syncError,    setSyncError]    = useState('');
    const [syncInfo,     setSyncInfo]     = useState('');
    const [pending,      setPending]      = useState([]);
    const [skipped,      setSkipped]      = useState(new Set());
    const [debugData,    setDebugData]    = useState([]);
    const [showDebug,    setShowDebug]    = useState(false);
    const [resetting,    setResetting]    = useState(false);

    // Auto-check connection when user returns focus to window after popup
    useEffect(() => {
        const handleFocus = () => {
            if (isGmailConnected()) {
                setConnected(true);
                setSyncError('');
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // ── Connect / Disconnect ────────────────────────────────────────────────

    const handleConnect = () => {
        setSyncError('');
        setSyncInfo('');
        connectGmail(
            (token) => {
                setConnected(true);
                setSyncInfo('Gmail connected successfully! Click Sync Now below to scan your inbox.');
            },
            (err) => {
                console.error('Connect error:', err);
                setSyncError(err.message);
            }
        );
    };

    const handleDisconnect = () => {
        disconnectGmail();
        setConnected(false);
        setPending([]);
        setSyncInfo('');
        setSyncError('');
        setDebugData([]);
    };

    // ── Reset processed IDs ─────────────────────────────────────────────────
    const handleReset = async () => {
        if (!confirm('This will clear the scan history and allow previously scanned emails to appear again. Continue?')) return;
        setResetting(true);
        try {
            const { supabase } = await import('../utils/supabaseClient');
            await supabase.from('gmail_processed').delete().eq('user_id', user.id);
            setDebugData([]);
            setSyncInfo('Scan history cleared. Click Sync Now to scan.');
            setSyncError('');
            setPending([]);
        } catch (err) {
            setSyncError('Reset failed: ' + err.message);
        } finally {
            setResetting(false);
        }
    };

    // ── Sync ────────────────────────────────────────────────────────────────

    const handleSync = async () => {
        if (!user) {
            setSyncError('User session not ready. Please try again.');
            return;
        }
        setSyncing(true);
        setSyncError('');
        setSyncInfo('');
        try {
            const days     = Math.max(1, Math.min(90, parseInt(daysBack) || 10));
            const messages = await fetchNewMessages(user.id, days);
            const { matched, unmatched } = parseEmails(messages, true);

            // Mark unmatched as processed so they don't block future scans
            const unmatchedIds = unmatched.map(m => m.messageId).filter(Boolean);
            if (unmatchedIds.length) await markProcessed(user.id, unmatchedIds);

            setDebugData(unmatched);
            if (matched.length === 0) {
                if (messages.length === 0) {
                    setSyncInfo(`Scanned inbox for the last ${days} days — no new emails found.`);
                } else {
                    setSyncInfo(`Scanned ${messages.length} email${messages.length !== 1 ? 's' : ''} — no new transaction alerts matched.`);
                }
            } else {
                setSyncInfo(`Found ${matched.length} transaction${matched.length !== 1 ? 's' : ''} to review.`);
            }
            setPending(prev => {
                const existing = new Set(prev.map(p => p.messageId));
                return [...prev, ...matched.filter(p => !existing.has(p.messageId))];
            });
        } catch (err) {
            console.error('Gmail sync error:', err);
            setSyncError(err.message || 'Failed to sync emails from Gmail.');
        } finally {
            setSyncing(false);
        }
    };

    // ── Per-card actions ────────────────────────────────────────────────────

    const handleSkip = useCallback(async (messageId) => {
        await markProcessed(user.id, [messageId]);
        setSkipped(prev => new Set([...prev, messageId]));
        setPending(prev => prev.filter(p => p.messageId !== messageId));
    }, [user.id]);

    const handleSave = useCallback(async (messageId, formData) => {
        try {
            await addExpense({
                title:             formData.description,
                amount:            formData.amount,
                description:       `Imported from Gmail (${formData.bank})`,
                category_id:       formData.category_id || null,
                payment_method_id: formData.payment_method_id || null,
                transaction_date:  formData.date,
            });
            await markProcessed(user.id, [messageId]);
            setPending(prev => prev.filter(p => p.messageId !== messageId));
        } catch (err) {
            alert('Failed to save: ' + err.message);
        }
    }, [addExpense, user.id]);

    // ── Render ──────────────────────────────────────────────────────────────

    const expenseCategories = categories.filter(c => c.type === 'expense');
    const visiblePending    = pending.filter(p => !skipped.has(p.messageId));

    return (
        <div className="gmail-sync-page">
            <h1 className="gmail-sync-title">
                <Mail size={28} color="var(--primary)" /> Gmail Sync
            </h1>

            {/* Connect card */}
            <Card className="gmail-connect-card">
                <div className="gmail-connect-row">
                    <div className="gmail-connect-info">
                        <div className="gmail-connect-status">
                            {connected
                                ? <><CheckCircle2 size={18} color="var(--success)" /> Gmail connected</>
                                : <><XCircle size={18} color="var(--text-muted)" /> Not connected</>
                            }
                        </div>
                        <p className="gmail-connect-desc">
                            {connected
                                ? 'Your Gmail is linked. Use the sync button below to scan for bank emails.'
                                : 'Connect Gmail to automatically detect bank & UPI transactions from your emails.'
                            }
                        </p>
                    </div>
                    {connected
                        ? <Button variant="outline" onClick={handleDisconnect}>
                            <Unlink size={16} /> Disconnect
                          </Button>
                        : <Button variant="primary" onClick={handleConnect} loading={connecting}>
                            <Mail size={16} /> Connect Gmail
                          </Button>
                    }
                </div>

                {syncError && (
                    <div className="gmail-error" style={{ marginTop: '0.75rem' }}>
                        <AlertTriangle size={14} /> {syncError}
                    </div>
                )}

                {/* Privacy note */}
                <div className="gmail-privacy-note">
                    <Info size={14} />
                    Read-only access · emails never leave your device · only amount &amp; date are extracted
                </div>
            </Card>

            {/* Sync controls */}
            {connected && (
                <Card className="gmail-sync-controls">
                    <div className="gmail-sync-row">
                        <div className="gmail-days-input">
                            <label className="gmail-label">Scan last</label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                value={daysBack}
                                onChange={e => setDaysBack(e.target.value)}
                                className="gmail-days-field"
                            />
                            <span className="gmail-label">days</span>
                        </div>
                        <Button
                            variant="primary"
                            onClick={handleSync}
                            loading={syncing}
                            disabled={!currentFamily}
                        >
                            <RefreshCw size={16} /> Sync Now
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            loading={resetting}
                            title="Re-scan emails that were already processed"
                        >
                            ↺ Reset
                        </Button>
                    </div>

                    {!currentFamily && (
                        <div className="gmail-warn">
                            <AlertTriangle size={14} /> Select a family first to save transactions.
                        </div>
                    )}
                    {syncInfo && <div className="gmail-info"><Info size={14} /> {syncInfo}</div>}
                </Card>
            )}

            {/* Pending review tray */}
            {visiblePending.length > 0 && (
                <div className="gmail-pending-section">
                    <h2 className="gmail-pending-title">
                        Pending Review
                        <span className="gmail-pending-badge">{visiblePending.length}</span>
                    </h2>
                    <p className="gmail-pending-desc">
                        Fill in category and description, then save. Skip to dismiss permanently.
                    </p>
                    <div className="gmail-pending-list">
                        {visiblePending.map(tx => (
                            <PendingCard
                                key={tx.messageId}
                                tx={tx}
                                categories={expenseCategories}
                                paymentMethods={paymentMethods}
                                onSave={handleSave}
                                onSkip={handleSkip}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {connected && visiblePending.length === 0 && !syncing && syncInfo && (
                <Card className="gmail-empty">
                    <CheckCircle2 size={40} color="var(--success)" />
                    <p>{syncInfo}</p>
                </Card>
            )}

            {/* Debug panel — shows why emails didn't match */}
            {debugData.length > 0 && (
                <div className="gmail-debug-section">
                    <button
                        className="gmail-debug-toggle"
                        onClick={() => setShowDebug(v => !v)}
                    >
                        {showDebug ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Debug: {debugData.length} unmatched email{debugData.length !== 1 ? 's' : ''}
                    </button>
                    {showDebug && (
                        <div className="gmail-debug-list">
                            {debugData.map((d, i) => (
                                <div key={i} className="gmail-debug-item">
                                    <div className="debug-from"><strong>From:</strong> {d.sender}</div>
                                    <div className="debug-subject"><strong>Subject:</strong> {d.subject}</div>
                                    {d.debugLog?.map((log, j) => (
                                        <div key={j} className={`debug-pattern ${log.senderOk && log.subjectOk ? 'debug-close' : 'debug-miss'}`}>
                                            {log.bank}: sender={log.senderOk ? '✅' : '❌'} subject={log.subjectOk ? '✅' : '❌'}
                                            {log.failReason ? ` → ${log.failReason}` : ''}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Pending Transaction Card ────────────────────────────────────────────────

const PendingCard = ({ tx, categories, paymentMethods, onSave, onSkip }) => {
    const [saving, setSaving] = useState(false);

    // Pre-fill payment method by matching paymentType
    const guessedMethod = paymentMethods.find(pm =>
        tx.paymentType === 'credit_card' ? pm.type === 'credit_card' :
        tx.paymentType === 'upi'         ? pm.type === 'upi' || pm.name.toLowerCase().includes('upi') :
                                           pm.type === 'bank'
    );

    const [form, setForm] = useState({
        amount:            tx.amount,
        date:              tx.date,
        description:       tx.description || '',
        category_id:       '',
        payment_method_id: guessedMethod?.id || '',
        bank:              tx.bank,
    });

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.description.trim()) { alert('Please enter a description.'); return; }
        setSaving(true);
        await onSave(tx.messageId, form);
        setSaving(false);
    };

    const categoryOptions = [
        { value: '', label: 'Select category…' },
        ...categories.map(c => ({ value: c.id, label: `${c.icon || ''} ${c.name}` })),
    ];
    const paymentOptions = [
        { value: '', label: 'Select payment method…' },
        ...paymentMethods.map(pm => ({ value: pm.id, label: pm.name })),
    ];

    return (
        <Card className="gmail-pending-card">
            {/* Header */}
            <div className="pending-card-header">
                <div className="pending-bank-badge">
                    {PAYMENT_TYPE_ICONS[tx.paymentType]}
                    {tx.bank}
                </div>
                <span className="pending-amount">₹{tx.amount.toLocaleString('en-IN')}</span>
            </div>

            <div className="pending-date">{tx.date}</div>

            {/* Email snippet */}
            <div className="pending-snippet">{tx.rawSnippet}</div>

            {/* Form fields — user must fill */}
            <div className="pending-form">
                <div className="pending-form-row">
                    <Input
                        label="Description *"
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="What was this for?"
                    />
                </div>
                <div className="pending-form-row two-col">
                    <div>
                        <label className="pending-field-label">Category</label>
                        <select
                            className="pending-select"
                            value={form.category_id}
                            onChange={e => set('category_id', e.target.value)}
                        >
                            {categoryOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="pending-field-label">Payment Method</label>
                        <select
                            className="pending-select"
                            value={form.payment_method_id}
                            onChange={e => set('payment_method_id', e.target.value)}
                        >
                            {paymentOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="pending-form-row two-col">
                    <div>
                        <label className="pending-field-label">Amount</label>
                        <input
                            type="number"
                            className="pending-input"
                            value={form.amount}
                            onChange={e => set('amount', parseFloat(e.target.value))}
                            step="0.01"
                        />
                    </div>
                    <div>
                        <label className="pending-field-label">Date</label>
                        <input
                            type="date"
                            className="pending-input"
                            value={form.date}
                            onChange={e => set('date', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="pending-actions">
                <Button variant="ghost" onClick={() => onSkip(tx.messageId)}>
                    <XCircle size={16} /> Skip
                </Button>
                <Button variant="primary" onClick={handleSave} loading={saving}>
                    <CheckCircle2 size={16} /> Save Transaction
                </Button>
            </div>
        </Card>
    );
};

export default GmailSync;
