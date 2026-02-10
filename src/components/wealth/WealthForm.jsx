import React, { useState, useEffect } from 'react';
import { useBudget } from '../../contexts/BudgetContext';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import './WealthForm.css';

const ASSET_TYPES = [
    { value: 'mutual_fund', label: 'Mutual Fund', icon: '📈' },
    { value: 'stock', label: 'Stock', icon: '📊' },
    { value: 'epf', label: 'EPF', icon: '🏦' },
    { value: 'nps', label: 'NPS', icon: '🏛️' },
    { value: 'bank', label: 'Bank Account', icon: '💰' },
    { value: 'fd', label: 'Fixed Deposit', icon: '🏅' }
];

const WealthForm = ({ isOpen, onClose, editAsset = null }) => {
    const { currentFamily, addWealthAsset, updateWealthAsset } = useBudget();
    const [formData, setFormData] = useState({
        asset_type: 'mutual_fund',
        asset_name: '',
        invested_amount: '',
        current_amount: '',
        maturity_amount: '',
        maturity_date: '',
        notes: ''
    });
    const [sharedWith, setSharedWith] = useState([]);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch family members for sharing - from ALL families
    useEffect(() => {
        const fetchMembers = async () => {
            if (!isOpen) return;

            const { supabase } = await import('../../utils/supabaseClient');
            const { data: userData } = await supabase.auth.getUser();
            const currentUserId = userData?.user?.id;

            // Get all families the user belongs to
            const { data: userFamilies } = await supabase
                .from('family_members')
                .select('family_id')
                .eq('user_id', currentUserId);

            if (!userFamilies || userFamilies.length === 0) return;

            const familyIds = userFamilies.map(f => f.family_id);

            // Get all members from those families
            const { data } = await supabase
                .from('family_members')
                .select('user_id, role, family_id, profiles(email), families(name)')
                .in('family_id', familyIds)
                .neq('user_id', currentUserId);  // Exclude current user

            if (data) {
                // Add family name to each member for clarity
                const membersWithFamilyInfo = data.map(m => ({
                    ...m,
                    displayName: `${m.profiles?.email} (${m.families?.name})`
                }));
                setFamilyMembers(membersWithFamilyInfo);
            }
        };

        if (isOpen) {
            fetchMembers();
        }
    }, [isOpen]);

    // Load edit data
    useEffect(() => {
        if (editAsset) {
            setFormData({
                asset_type: editAsset.asset_type,
                asset_name: editAsset.asset_name,
                invested_amount: editAsset.invested_amount || '',
                current_amount: editAsset.current_amount || '',
                maturity_amount: editAsset.maturity_amount || '',
                maturity_date: editAsset.maturity_date || '',
                notes: editAsset.notes || ''
            });

            // Load existing sharing
            if (editAsset.wealth_sharing) {
                setSharedWith(editAsset.wealth_sharing.map(s => s.shared_with_user_id));
            }
        } else {
            resetForm();
        }
    }, [editAsset, isOpen]);

    const resetForm = () => {
        setFormData({
            asset_type: 'mutual_fund',
            asset_name: '',
            invested_amount: '',
            current_amount: '',
            maturity_amount: '',
            maturity_date: '',
            notes: ''
        });
        setSharedWith([]);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleShare = (userId) => {
        setSharedWith(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const assetData = {
                ...formData,
                invested_amount: parseFloat(formData.invested_amount) || 0,
                current_amount: parseFloat(formData.current_amount) || 0,
                maturity_amount: formData.maturity_amount ? parseFloat(formData.maturity_amount) : null,
                maturity_date: formData.maturity_date || null
            };

            if (editAsset) {
                await updateWealthAsset(editAsset.id, assetData, sharedWith);
            } else {
                await addWealthAsset(assetData, sharedWith);
            }

            resetForm();
            onClose();
        } catch (error) {
            console.error('Error saving wealth asset:', error);
            alert('Failed to save asset');
        } finally {
            setLoading(false);
        }
    };

    const isFD = formData.asset_type === 'fd';
    const isBank = formData.asset_type === 'bank';
    const selectedType = ASSET_TYPES.find(t => t.value === formData.asset_type);

    console.log('WealthForm render, isOpen:', isOpen, 'editAsset:', editAsset);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${editAsset ? 'Edit' : 'Add'} ${selectedType?.label || 'Asset'}`}>
            <form onSubmit={handleSubmit} className="wealth-form">
                {/* Asset Type */}
                <div className="form-group">
                    <label>Asset Type *</label>
                    <div className="asset-type-grid">
                        {ASSET_TYPES.map(type => (
                            <button
                                key={type.value}
                                type="button"
                                className={`asset-type-btn ${formData.asset_type === type.value ? 'active' : ''}`}
                                onClick={() => setFormData(prev => ({ ...prev, asset_type: type.value }))}
                            >
                                <span className="asset-icon">{type.icon}</span>
                                <span className="asset-label">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Asset Name */}
                <Input
                    label="Asset Name *"
                    name="asset_name"
                    value={formData.asset_name}
                    onChange={handleChange}
                    placeholder={`e.g., ${selectedType?.label} Name`}
                    required
                />

                {/* Invested Amount (not for bank) */}
                {!isBank && (
                    <Input
                        label="Invested Amount *"
                        name="invested_amount"
                        type="number"
                        step="0.01"
                        value={formData.invested_amount}
                        onChange={handleChange}
                        placeholder="₹ 0.00"
                        required
                    />
                )}

                {/* Current Amount/Balance */}
                <Input
                    label={isBank ? "Current Balance *" : "Current Value *"}
                    name="current_amount"
                    type="number"
                    step="0.01"
                    value={formData.current_amount}
                    onChange={handleChange}
                    placeholder="₹ 0.00"
                    required
                />

                {/* FD Specific Fields */}
                {isFD && (
                    <>
                        <Input
                            label="Maturity Amount *"
                            name="maturity_amount"
                            type="number"
                            step="0.01"
                            value={formData.maturity_amount}
                            onChange={handleChange}
                            placeholder="₹ 0.00"
                            required
                        />
                        <Input
                            label="Maturity Date *"
                            name="maturity_date"
                            type="date"
                            value={formData.maturity_date}
                            onChange={handleChange}
                            required
                        />
                    </>
                )}

                {/* Notes */}
                <div className="form-group">
                    <label>Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Additional notes..."
                        rows={3}
                    />
                </div>

                {/* Share With */}
                {familyMembers.length > 0 && (
                    <div className="form-group">
                        <label>Share With Family Members</label>
                        <div className="share-list">
                            {familyMembers.map(member => (
                                <div key={member.user_id} className="share-item">
                                    <input
                                        type="checkbox"
                                        id={`share-${member.user_id}`}
                                        checked={sharedWith.includes(member.user_id)}
                                        onChange={() => toggleShare(member.user_id)}
                                    />
                                    <label htmlFor={`share-${member.user_id}`}>
                                        {member.displayName || member.profiles?.email}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="modal-actions">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : editAsset ? 'Update' : 'Add'} Asset
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default WealthForm;
