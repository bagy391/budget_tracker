import React, { useState } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Button from '../common/Button';
import WealthForm from './WealthForm';
import './WealthList.css';

const ASSET_TYPE_LABELS = {
    mutual_fund: { label: 'Mutual Fund', icon: '📈' },
    stock: { label: 'Stock', icon: '📊' },
    epf: { label: 'EPF', icon: '🏦' },
    nps: { label: 'NPS', icon: '🏛️' },
    bank: { label: 'Bank', icon: ' 💰' },
    fd: { label: 'Fixed Deposit', icon: '🏅' }
};

const WealthList = () => {
    const { wealthAssets, deleteWealthAsset } = useBudget();
    const [showForm, setShowForm] = useState(false);
    const [editAsset, setEditAsset] = useState(null);
    const [selectedType, setSelectedType] = useState('all');

    const handleEdit = (asset) => {
        setEditAsset(asset);
        setShowForm(true);
    };

    const handleDelete = async (assetId) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        try {
            await deleteWealthAsset(assetId);
        } catch (error) {
            alert('Failed to delete asset');
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditAsset(null);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const calculateROI = (invested, current) => {
        if (!invested || invested === 0) return 0;
        return ((current - invested) / invested * 100).toFixed(2);
    };

    const getDaysUntilMaturity = (maturityDate) => {
        if (!maturityDate) return null;
        const days = Math.ceil((new Date(maturityDate) - new Date()) / (1000 * 60 * 60 * 24));
        return days;
    };

    const filteredAssets = selectedType === 'all'
        ? wealthAssets
        : wealthAssets.filter(a => a.asset_type === selectedType);

    const groupedAssets = filteredAssets.reduce((acc, asset) => {
        const type = asset.asset_type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(asset);
        return acc;
    }, {});

    const ownAssets = wealthAssets.filter(a => a.isOwner);
    const sharedAssets = wealthAssets.filter(a => !a.isOwner);

    const handleAddClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Add Asset clicked, current showForm:', showForm);
        setShowForm(true);
        console.log('setShowForm(true) called');
    };

    console.log('WealthList render, showForm:', showForm);

    return (
        <div className="wealth-list">
            <div className="wealth-list-header">
                <h3>Wealth Assets</h3>
                <Button type="button" onClick={handleAddClick}>+ Add Asset</Button>
            </div>

            {/* Filter */}
            <div className="wealth-filter">
                <button
                    className={`filter-btn ${selectedType === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedType('all')}
                >
                    All
                </button>
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
                                    <span>{typeInfo.icon} {typeInfo.label}</span>
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
                            return (
                                <div key={asset.id} className="asset-card shared">
                                    <div className="asset-card-header">
                                        <span className="asset-type-badge">
                                            {typeInfo.icon} {typeInfo.label}
                                        </span>
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
                                    </div>
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

            <WealthForm
                isOpen={showForm}
                onClose={handleCloseForm}
                editAsset={editAsset}
            />
        </div>
    );
};

const AssetCard = ({ asset, onEdit, onDelete, formatCurrency, calculateROI, getDaysUntilMaturity }) => {
    const typeInfo = ASSET_TYPE_LABELS[asset.asset_type];
    const roi = asset.asset_type !== 'bank' ? calculateROI(asset.invested_amount, asset.current_amount) : null;
    const daysUntilMaturity = asset.asset_type === 'fd' ? getDaysUntilMaturity(asset.maturity_date) : null;

    const getMaturityStatus = (days) => {
        if (days <= 0) return 'matured';
        if (days <= 3) return 'critical';
        if (days <= 7) return 'warning';
        if (days <= 30) return 'info';
        return 'normal';
    };

    return (
        <div className={`asset-card ${daysUntilMaturity !== null ? getMaturityStatus(daysUntilMaturity) : ''}`}>
            <div className="asset-card-header">
                <span className="asset-type-badge">
                    {typeInfo.icon} {typeInfo.label}
                </span>
                <div className="asset-actions">
                    <button className="icon-btn" onClick={() => onEdit(asset)} title="Edit">
                        ✏️
                    </button>
                    <button className="icon-btn delete" onClick={() => onDelete(asset.id)} title="Delete">
                        🗑️
                    </button>
                </div>
            </div>

            <h5 className="asset-name">{asset.asset_name}</h5>

            {asset.asset_type === 'fd' && daysUntilMaturity !== null && (
                <div className={`maturity-alert ${getMaturityStatus(daysUntilMaturity)}`}>
                    {daysUntilMaturity <= 0 ? '🎉 Matured!' : `⏰ ${daysUntilMaturity} days until maturity`}
                </div>
            )}

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
                {asset.asset_type === 'fd' && (
                    <div className="stat">
                        <span className="stat-label">Maturity</span>
                        <span className="stat-value">{formatCurrency(asset.maturity_amount)}</span>
                    </div>
                )}
            </div>

            {roi !== null && (
                <div className={`roi-badge ${parseFloat(roi) >= 0 ? 'positive' : 'negative'}`}>
                    {parseFloat(roi) >= 0 ? '📈' : '📉'} {roi}% ROI
                </div>
            )}

            {asset.notes && (
                <div className="asset-notes">{asset.notes}</div>
            )}

            {asset.wealth_sharing && asset.wealth_sharing.length > 0 && (
                <div className="shared-with">
                    👥 Shared with {asset.wealth_sharing.length} member{asset.wealth_sharing.length > 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};

export default WealthList;
