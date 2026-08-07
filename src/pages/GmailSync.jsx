import React, { useState, useCallback, useEffect } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth }   from '../contexts/AuthContext';
import Card    from '../components/common/Card';
import Button  from '../components/common/Button';
import Input   from '../components/common/Input';
import Select  from '../components/common/Select';
import DynamicIcon from '../components/common/DynamicIcon';
import { connectGmail, disconnectGmail, isGmailConnected, getDiagLogs } from '../utils/gmail/gmailAuth';
import { fetchNewMessages, markProcessed } from '../utils/gmail/gmailClient';
import { parseEmails } from '../utils/gmail/parserEngine';
import {
    Mail, RefreshCw, CheckCircle2, XCircle, Unlink, AlertTriangle,
    Banknote, CreditCard, Wallet, Info, ChevronDown, ChevronUp, RotateCcw, Bug, Clock
} from 'lucide-react';
import './GmailSync.css';

const PAYMENT_TYPE_ICONS = {
    bank:        <Banknote size={14} />,
    credit_card: <CreditCard size={14} />,
    upi:         <Wallet size={14} />,
};

function formatLastSynced(isoStr) {
    if (!isoStr) return null;
    const date = new Date(isoStr);
    if (isNaN(date)) return null;

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
}

const GmailSync = () => {
    const { user }   = useAuth();
    const { categories, paymentMethods, addExpense, currentFamily } = useBudget();

    const lastSyncKey = `gmail_last_synced_${user?.id || 'default'}`;

    const [connected,    setConnected]    = useState(isGmailConnected());
    const [connecting,   setConnecting]   = useState(false);
    const [daysBack,     setDaysBack]     = useState('1');
    const [syncing,      setSyncing]      = useState(false);
    const [syncError,    setSyncError]    = useState('');
    const [syncInfo,     setSyncInfo]     = useState('');
    const [pending,      setPending]      = useState([]);
    const [skipped,      setSkipped]      = useState(new Set());
    const [debugData,    setDebugData]    = useState([]);
    const [showDebug,    setShowDebug]    = useState(false);
    const [showDiag,     setShowDiag]     = useState(false);
    const [resetting,    setResetting]    = useState(false);
    const [diagLogs,     setDiagLogs]     = useState([]);
    const [lastSyncedAt, setLastSyncedAt] = useState(() => localStorage.getItem(lastSyncKey));

    // Update stored key when user changes
    useEffect(() => {
        if (user?.id) {
            const stored = localStorage.getItem(`gmail_last_synced_${user.id}`);
            if (stored) setLastSyncedAt(stored);
        }
    }, [user?.id]);

    const refreshDiag = () => {
        setDiagLogs(getDiagLogs());
    };

    // Auto-check connection when user returns focus to window after popup
    useEffect(() => {
        const handleFocus = () => {
            if (isGmailConnected()) {
                setConnected(true);
                setSyncError('');
            }
            refreshDiag();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // ── Connect / Disconnect ────────────────────────────────────────────────

    const handleConnect = () => {
        setSyncError('');
        setSyncInfo('');
        setConnecting(true);
        refreshDiag();
        connectGmail(
            (token) => {
                setConnected(true);
                setConnecting(false);
                setSyncInfo('Gmail connected successfully! Click Sync Now below to scan your inbox.');
                refreshDiag();
            },
            (err) => {
                console.error('Connect error:', err);
                setSyncError(err.message);
                setConnecting(false);
                refreshDiag();
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
        refreshDiag();
    };

    const handleManualRecheck = () => {
        const status = isGmailConnected();
        setConnected(status);
        if (status) {
            setSyncError('');
            setSyncInfo('Connection active! Found valid token in storage.');
        } else {
            setSyncError('No valid access token found in local storage.');
        }
        refreshDiag();
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
            // Calculate days to scan: default 1 day, or elapsed days since last sync if larger
            let daysToScan = parseInt(daysBack) || 1;
            if (lastSyncedAt) {
                const elapsedDays = Math.ceil((Date.now() - new Date(lastSyncedAt).getTime()) / 86400000);
                if (elapsedDays > daysToScan) {
                    daysToScan = Math.min(90, elapsedDays);
                }
            }
            const days = Math.max(1, Math.min(90, daysToScan));

            const messages = await fetchNewMessages(user.id, days);
            const { matched, unmatched } = parseEmails(messages, true);

            // Mark unmatched as processed so they don't block future scans
            const unmatchedIds = unmatched.map(m => m.messageId).filter(Boolean);
            if (unmatchedIds.length) await markProcessed(user.id, unmatchedIds);

            // Update last synced timestamp
            const nowIso = new Date().toISOString();
            localStorage.setItem(lastSyncKey, nowIso);
            setLastSyncedAt(nowIso);

            setDebugData(unmatched);
            if (matched.length === 0) {
                if (messages.length === 0) {
                    setSyncInfo(`Scanned inbox for the last ${days} day${days !== 1 ? 's' : ''} — no new emails found.`);
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
    const clientIdVal       = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const formattedLastSync = formatLastSynced(lastSyncedAt);

    return (
        <div className="gmail-sync-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 className="gmail-sync-title" style={{ margin: 0 }}>
                    <Mail size={28} color="var(--primary)" /> Gmail Sync
                </h1>
                {lastSyncedAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--surface-variant)', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
                        <Clock size={14} color="var(--primary)" />
                        <span>Last synced: <strong>{formattedLastSync}</strong></span>
                    </div>
                )}
            </div>

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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {connected
                            ? <Button variant="outline" onClick={handleDisconnect}>
                                <Unlink size={16} /> Disconnect
                              </Button>
                            : <Button variant="primary" onClick={handleConnect} loading={connecting}>
                                <Mail size={16} /> Connect Gmail
                              </Button>
                        }
                        <Button variant="ghost" onClick={handleManualRecheck} title="Re-check local storage token status">
                            <RefreshCw size={14} /> Re-check
                        </Button>
                    </div>
                </div>

                {syncError && (
                    <div className="gmail-error" style={{ marginTop: '0.75rem' }}>
                        <AlertTriangle size={14} /> {syncError}
                    </div>
                )}

                {/* Diagnostic drawer toggle */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="gmail-privacy-note" style={{ marginTop: 0 }}>
                        <Info size={14} />
                        Read-only access · emails parsed locally · only amount &amp; date extracted
                    </div>
                    <button
                        onClick={() => { setShowDiag(v => !v); refreshDiag(); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                        <Bug size={14} /> OAuth Diag {showDiag ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                </div>

                {/* Diagnostic Panel */}
                {showDiag && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-variant)', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--on-surface-variant)' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>🛠️ Live OAuth Diagnostics:</div>
                        <div>• Domain Origin: <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code></div>
                        <div>• Client ID: <code>{clientIdVal ? `${clientIdVal.slice(0, 16)}...` : '❌ MISSING IN BUILD!'}</code></div>
                        <div>• GIS Script Loaded: <code>{typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2) ? '✅ Yes' : '❌ No'}</code></div>
                        <div>• Local Token Present: <code>{connected ? '✅ Yes' : '❌ No'}</code></div>
                        <div>• Last Synced At: <code>{lastSyncedAt || 'Never'}</code></div>
                        
                        <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Event Logs ({diagLogs.length}):</div>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--background)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                            {diagLogs.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>No logs yet. Click Connect Gmail to log events.</div>
                            ) : (
                                diagLogs.map((l, i) => (
                                    <div key={i} style={{ marginBottom: '0.25rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--primary)' }}>[{l.time}]</span> {l.msg}
                                        {l.data && <pre style={{ margin: '0.2rem 0 0 1rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.data, null, 2)}</pre>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
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
                            <span className="gmail-label">day{daysBack !== '1' ? 's' : ''}</span>
                        </div>
                        <Button
                            variant="primary"
                            onClick={handleSync}
                            loading={syncing}
                            disabled={!currentFamily}
                        >
                            <RefreshCw size={16} /> Sync Now
                        </Button>
                        {/* Reset button disabled for now */}
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

    const categoryOptions = categories.map(c => ({
        value: c.id,
        label: c.name,
        icon:  <DynamicIcon name={c.icon} size={16} />,
    }));
    const paymentOptions = paymentMethods.map(pm => ({
        value: pm.id,
        label: pm.name,
        icon:  pm.type === 'credit_card' ? <CreditCard size={16} /> : pm.type === 'upi' ? <Wallet size={16} /> : <Banknote size={16} />,
    }));

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
                    <Select
                        label="Category"
                        value={form.category_id}
                        onChange={val => set('category_id', val)}
                        options={categoryOptions}
                        placeholder="Select category…"
                    />
                    <Select
                        label="Payment Method"
                        value={form.payment_method_id}
                        onChange={val => set('payment_method_id', val)}
                        options={paymentOptions}
                        placeholder="Select payment method…"
                    />
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
