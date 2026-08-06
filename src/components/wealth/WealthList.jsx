import React, { useState } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Button from '../common/Button';
import WealthForm from './WealthForm';
import { TrendingUp, TrendingDown, BarChart2, Landmark, Building2, Wallet, Award, Edit2, Trash2, Users, AlertTriangle, PartyPopper, Clock } from 'lucide-react';
import './WealthList.css';

const ASSET_TYPE_LABELS = {
    mutual_fund: { label: 'Mutual Fund', icon: <TrendingUp size={14} /> },
    stock:       { label: 'Stock',        icon: <BarChart2 size={14} /> },
    epf:         { label: 'EPF',          icon: <Landmark size={14} /> },
    nps:         { label: 'NPS',          icon: <Building2 size={14} /> },
    bank:        { label: 'Bank',         icon: <Wallet size={14} /> },
    fd:          { label: 'Fixed Deposit',icon: <Award size={14} /> }
};

const WealthList = () => {
    const { wealthAssets, deleteWealthAsset } = useBudget();
    const [showForm, setShowForm]     = useState(false);
    const [editAsset, setEditAsset]   = useState(null);
    const [selectedType, setSelectedType] = useState('all');

    const handleEdit  = (asset) => { setEditAsset(asset); setShowForm(true); };
    const handleDelete = async (assetId) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        try { await deleteWealthAsset(assetId); }
        catch { alert('Failed to delete asset'); }
    };
    const handleCloseForm = () => { setShowForm(false); setEditAsset(null); };
    const handleAddClick  = (e) => { e.preventDefault(); e.stopPropagation(); setShowForm(true); };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const calculateROI = (invested, current) => {
        if (!invested || invested === 0) return null;
        if (current === undefined || current === null) return 0;
        return ((current - invested) / invested * 100).toFixed(2);
    };

    const getDaysUntilMaturity = (maturityDate) => {
        if (!maturityDate) return null;
        return Math.ceil((new Date(maturityDate) - new Date()) / (1000 * 60 * 60 * 24));
    };

    // Summary totals
    const totalInvested = wealthAssets
        .filter(a => a.asset_type !== 'bank')
        .reduce((s, a) => s + parseFloat(a.invested_amount || 0), 0);
    const totalCurrent = wealthAssets
        .reduce((s, a) => s + parseFloat(a.current_amount || 0), 0);
    const totalGain    = totalCurrent - totalInvested;

    const filteredAssets = (selectedType === 'all' ? wealthAssets : wealthAssets.filter(a => a.asset_type === selectedType))
        .slice()
        .sort((a, b) => {
            // FD assets with maturity dates come first, soonest first (overdue = earliest)
            const aDate = a.maturity_date ? new Date(a.maturity_date) : null;
            const bDate = b.maturity_date ? new Date(b.maturity_date) : null;
            if (aDate && bDate) return aDate - bDate;   // both have date: sort ascending
            if (aDate) return -1;                        // only a has date: a first
            if (bDate) return 1;                         // only b has date: b first
            return 0;                                    // neither: preserve order
        });

    const groupedAssets   = filteredAssets.reduce((acc, asset) => {
        const type = asset.asset_type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(asset);
        return acc;
    }, {});

    const ownAssets    = filteredAssets.filter(a =>  a.isOwner);
    const sharedAssets = filteredAssets.filter(a => !a.isOwner);

    return (
        <div className="wealth-list">
            {/* Header */}
            <div className="wealth-list-header">
                <h3>Wealth Assets</h3>
                <Button type="button" onClick={handleAddClick}>+ Add Asset</Button>
            </div>

            {/* Summary strip */}
            {wealthAssets.length > 0 && (
                <div className="wealth-summary-strip">
                    <div className="wealth-summary-chip">
                        <span className="chip-label">Invested</span>
                        <span className="chip-value">{formatCurrency(totalInvested)}</span>
                    </div>
                    <div className="wealth-summary-chip">
                        <span className="chip-label">Current</span>
                        <span className="chip-value">{formatCurrency(totalCurrent)}</span>
                    </div>
                    <div className="wealth-summary-chip">
                        <span className="chip-label">Gain / Loss</span>
                        <span className={`chip-value ${totalGain >= 0 ? 'positive' : 'negative'}`}>
                            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
                        </span>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="wealth-filter">
                <button className={`filter-btn ${selectedType === 'all' ? 'active' : ''}`} onClick={() => setSelectedType('all')}>All</button>
                {Object.entries(ASSET_TYPE_LABELS).map(([type, { label, icon }]) => (
                    <button
                        key={type}
                        className={`filter-btn ${selectedType === type ? 'active' : ''}`}
                        onClick={() => setSelectedType(type)}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>

            {/* My Assets */}
            {ownAssets.length > 0 && (
                <div className="wealth-section">
                    <h4 className="section-title">My Assets</h4>
                    {Object.entries(groupedAssets).map(([type, assets]) => {
                        const typeAssets = assets.filter(a => a.isOwner);
                        if (typeAssets.length === 0) return null;
                        const typeInfo = ASSET_TYPE_LABELS[type];
                        return (
                            <div key={type} className="asset-type-group">
                                <div className="asset-type-header">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{typeInfo.icon} {typeInfo.label}</span>
                                    <span className="asset-count">{typeAssets.length}</span>
                                </div>
                                <div className="assets-grid">
                                    {typeAssets.map(asset => (
                                        <AssetCard
                                            key={asset.id}
                                            asset={asset}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            formatCurrency={formatCurrency}
                                            calculateROI={calculateROI}
                                            getDaysUntilMaturity={getDaysUntilMaturity}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Shared with Me */}
            {sharedAssets.length > 0 && (
                <div className="wealth-section">
                    <h4 className="section-title">Shared with Me</h4>
                    <div className="assets-grid">
                        {sharedAssets.map(asset => {
                            const typeInfo = ASSET_TYPE_LABELS[asset.asset_type];
                            const currentVal = asset.asset_type === 'fd' && asset.maturity_amount ? asset.maturity_amount : asset.current_amount;
                            const roi = asset.asset_type !== 'bank' ? calculateROI(asset.invested_amount, currentVal) : null;
                            const days = asset.asset_type === 'fd' ? getDaysUntilMaturity(asset.maturity_date) : null;
                            return (
                                <div key={asset.id} className="asset-card shared">
                                    <div className="asset-card-header">
                                        <span className="asset-type-badge">{typeInfo.icon} {typeInfo.label}</span>
                                        <span className="shared-badge">Shared</span>
                                    </div>
                                    <h5 className="asset-name">{asset.asset_name}</h5>
                                    <div className="asset-owner">Owner: {asset.profiles?.email}</div>
                                    <div className="asset-stats">
                                        {asset.asset_type !== 'bank' && (
                                            <div className="stat">
                                                <span className="stat-label">Invested</span>
                                                <span className="stat-value">{formatCurrency(asset.invested_amount)}</span>
                                            </div>
                                        )}
                                        <div className="stat">
                                            <span className="stat-label">Current</span>
                                            <span className="stat-value">{formatCurrency(asset.current_amount)}</span>
                                        </div>
                                        {asset.asset_type === 'fd' && asset.maturity_amount && (
                                            <div className="stat">
                                                <span className="stat-label">Maturity Amt</span>
                                                <span className="stat-value">{formatCurrency(asset.maturity_amount)}</span>
                                            </div>
                                        )}
                                    </div>
                                    {asset.asset_type === 'fd' && asset.maturity_date && (
                                        <div className="fd-maturity-date">
                                            <Clock size={12} />
                                            Matures: {new Date(asset.maturity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    )}
                                    {roi !== null && (
                                        <div className={`roi-badge ${parseFloat(roi) >= 0 ? 'positive' : 'negative'}`}>
                                            {parseFloat(roi) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {roi}% ROI
                                        </div>
                                    )}
                                    {days !== null && <MaturityAlert days={days} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {wealthAssets.length === 0 && (
                <div className="empty-state">
                    <p>No wealth assets yet. Add your first asset to get started!</p>
                </div>
            )}

            <WealthForm isOpen={showForm} onClose={handleCloseForm} editAsset={editAsset} />
        </div>
    );
};

/* ── Maturity alert helper ───────────────────── */
const getMaturityStatus = (days) => {
    if (days < 0) return 'overdue';
    if (days === 0) return 'matured';
    if (days <= 3) return 'critical';
    if (days <= 7) return 'warning';
    if (days <= 30) return 'info';
    return 'normal';
};

const MaturityAlert = ({ days }) => (
    <div className={`maturity-alert ${getMaturityStatus(days)}`}>
        {days < 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={14} /> Overdue by {Math.abs(days)} days
            </span>
        ) : days === 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <PartyPopper size={14} /> Matured Today!
            </span>
        ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Clock size={14} /> {days} days until maturity
            </span>
        )}
    </div>
);

/* ── Asset Card ──────────────────────────────── */
const AssetCard = ({ asset, onEdit, onDelete, formatCurrency, calculateROI, getDaysUntilMaturity }) => {
    const typeInfo     = ASSET_TYPE_LABELS[asset.asset_type];
    const currentVal   = asset.asset_type === 'fd' && asset.maturity_amount ? asset.maturity_amount : asset.current_amount;
    const roi          = asset.asset_type !== 'bank' ? calculateROI(asset.invested_amount, currentVal) : null;
    const daysUntilMaturity = asset.asset_type === 'fd' ? getDaysUntilMaturity(asset.maturity_date) : null;

    return (
        <div className={`asset-card ${daysUntilMaturity !== null ? getMaturityStatus(daysUntilMaturity) : ''}`}>
            <div className="asset-card-header">
                <span className="asset-type-badge">{typeInfo.icon} {typeInfo.label}</span>
                <div className="asset-actions">
                    <button className="icon-btn" onClick={() => onEdit(asset)} title="Edit"><Edit2 size={15} /></button>
                    <button className="icon-btn delete" onClick={() => onDelete(asset.id)} title="Delete"><Trash2 size={15} /></button>
                </div>
            </div>

            <h5 className="asset-name">{asset.asset_name}</h5>

            {daysUntilMaturity !== null && <MaturityAlert days={daysUntilMaturity} />}

            <div className="asset-stats">
                {asset.asset_type !== 'bank' && (
                    <div className="stat">
                        <span className="stat-label">Invested</span>
                        <span className="stat-value">{formatCurrency(asset.invested_amount)}</span>
                    </div>
                )}
                <div className="stat">
                    <span className="stat-label">{asset.asset_type === 'bank' ? 'Balance' : 'Current'}</span>
                    <span className="stat-value">{formatCurrency(asset.current_amount)}</span>
                </div>
                {asset.asset_type === 'fd' && asset.maturity_amount && (
                    <div className="stat">
                        <span className="stat-label">Maturity Amt</span>
                        <span className="stat-value">{formatCurrency(asset.maturity_amount)}</span>
                    </div>
                )}
            </div>

            {asset.asset_type === 'fd' && asset.maturity_date && (
                <div className="fd-maturity-date">
                    <Clock size={12} />
                    Matures: {new Date(asset.maturity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
            )}

            {roi !== null && (
                <div className={`roi-badge ${parseFloat(roi) >= 0 ? 'positive' : 'negative'}`}>
                    {parseFloat(roi) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {roi}% ROI
                </div>
            )}

            {asset.notes && <div className="asset-notes">{asset.notes}</div>}

            {asset.wealth_sharing?.length > 0 && (
                <div className="shared-with">
                    <Users size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                    Shared with {asset.wealth_sharing.length} member{asset.wealth_sharing.length > 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};

export default WealthList;
