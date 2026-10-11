import React, { useState, useEffect } from 'react';
import { Sparkles, Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, X, ExternalLink } from 'lucide-react';
import Button from '../common/Button';
import { getGeminiApiKey, setGeminiApiKey, getGeminiModel, setGeminiModel, testGeminiConnection } from '../../utils/geminiService';
import './ApiKeyModal.css';

const ApiKeyModal = ({ isOpen, onClose, userId, onKeySaved }) => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [model, setModel] = useState('gemini-3.7-flash');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setApiKey(getGeminiApiKey(userId));
            setModel(getGeminiModel());
            setTestResult(null);
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const handleTest = async () => {
        if (!apiKey.trim()) {
            setTestResult({ success: false, message: 'Please enter an API key first.' });
            return;
        }

        setTesting(true);
        setTestResult(null);
        try {
            const result = await testGeminiConnection(apiKey.trim(), model);
            setTestResult({
                success: result.success,
                message: result.success ? 'Connected successfully to Gemini!' : result.error
            });
        } catch (err) {
            setTestResult({
                success: false,
                message: err.message || 'Connection failed'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = () => {
        setGeminiApiKey(apiKey.trim(), userId);
        setGeminiModel(model);
        if (onKeySaved) {
            onKeySaved(apiKey.trim(), model);
        }
        onClose();
    };

    return (
        <div className="api-key-modal-overlay" onClick={onClose}>
            <div className="api-key-modal" onClick={e => e.stopPropagation()}>
                <div className="api-key-modal-header">
                    <div className="api-key-modal-title">
                        <Sparkles size={20} color="var(--primary)" />
                        <span>Google Gemini AI Settings</span>
                    </div>
                    <button className="api-key-close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>

                <div className="api-key-modal-body">
                    <div className="api-key-info-box">
                        <Key size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div className="api-key-info-text">
                            A Gemini API Key powers your AI spending trends and conversational advisor. You can generate a free API key at
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="api-key-info-link"
                            >
                                Google AI Studio <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                            </a>.
                        </div>
                    </div>

                    <div className="api-key-field-group">
                        <label className="api-key-label" htmlFor="gemini-api-key-input">Gemini API Key</label>
                        <div className="api-key-input-wrapper">
                            <input
                                id="gemini-api-key-input"
                                type={showKey ? 'text' : 'password'}
                                className="api-key-input"
                                placeholder="AIzaSy..."
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                            />
                            <button
                                type="button"
                                className="api-key-toggle-vis"
                                onClick={() => setShowKey(!showKey)}
                                title={showKey ? 'Hide key' : 'Show key'}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="api-key-field-group">
                        <label className="api-key-label" htmlFor="gemini-model-select">Gemini Model</label>
                        <select
                            id="gemini-model-select"
                            className="api-key-model-select"
                            value={model}
                            onChange={e => setModel(e.target.value)}
                        >
                            <option value="gemini-3.7-flash">Gemini 3.7 Flash (Recommended - Generous Free Quota & High Speed)</option>
                            <option value="gemini-flash-lite-latest">Gemini Flash Lite (Fast & High Availability)</option>
                            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                            <option value="gemini-flash-latest">Gemini Flash Latest</option>
                        </select>
                    </div>

                    {testResult && (
                        <div className={`api-key-status-msg ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success ? (
                                <CheckCircle2 size={16} />
                            ) : (
                                <AlertCircle size={16} />
                            )}
                            <span>{testResult.message}</span>
                        </div>
                    )}
                </div>

                <div className="api-key-modal-actions">
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={handleTest}
                        disabled={testing || !apiKey.trim()}
                    >
                        {testing ? <RefreshCw size={14} className="spin" /> : null}
                        {testing ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button
                        variant="primary"
                        size="small"
                        onClick={handleSave}
                    >
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
