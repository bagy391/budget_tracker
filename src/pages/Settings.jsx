import React, { useState, useEffect } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import EmojiPicker from '../components/common/EmojiPicker';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './Settings.css';

const Settings = () => {
    const {
        currentFamily,
        families,
        categories,
        paymentMethods,
        switchFamily,
        createFamily,
        deleteFamily,
        addCategory,
        updateCategory,
        deleteCategory,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        loading
    } = useBudget();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const [newFamilyName, setNewFamilyName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('');
    const [newCategoryType, setNewCategoryType] = useState('expense');
    const [newPaymentName, setNewPaymentName] = useState('');
    const [newPaymentType, setNewPaymentType] = useState('bank');

    // Family member management state
    const [familyMembers, setFamilyMembers] = useState([]);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Modal states
    const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);

    // Editing items
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);

    // Fetch family members
    useEffect(() => {
        if (currentFamily) {
            fetchFamilyMembers();
        }
    }, [currentFamily]);

    const fetchFamilyMembers = async () => {
        if (!currentFamily) return;

        setLoadingMembers(true);
        try {
            const { data, error } = await supabase
                .from('family_members')
                .select(`
                    *,
                    profiles:user_id (
                        id,
                        email,
                        full_name
                    )
                `)
                .eq('family_id', currentFamily.id);

            if (error) throw error;
            setFamilyMembers(data || []);
        } catch (error) {
            console.error('Error fetching family members:', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMemberEmail.trim() || !currentFamily) return;

        try {
            // Find user by email
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', newMemberEmail.trim())
                .single();

            if (userError || !userData) {
                alert('User not found. Please make sure they have signed up first.');
                return;
            }

            // Check if already a member
            const { data: existingMember } = await supabase
                .from('family_members')
                .select('id')
                .eq('family_id', currentFamily.id)
                .eq('user_id', userData.id)
                .single();

            if (existingMember) {
                alert('This user is already a member of this family.');
                return;
            }

            // Add member
            const { error: insertError } = await supabase
                .from('family_members')
                .insert({
                    family_id: currentFamily.id,
                    user_id: userData.id,
                    role: 'member'
                });

            if (insertError) throw insertError;

            setNewMemberEmail('');
            setShowAddMemberModal(false);
            await fetchFamilyMembers();
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Failed to add member. Please try again.');
        }
    };

    const handlePromoteToAdmin = async (memberId, userId) => {
        if (!isCurrentUserAdmin) {
            alert('Only admins can promote members.');
            return;
        }

        if (!confirm('Promote this member to admin?')) return;

        try {
            const { error } = await supabase
                .from('family_members')
                .update({ role: 'admin' })
                .eq('family_id', currentFamily.id)
                .eq('user_id', userId);

            if (error) throw error;
            await fetchFamilyMembers();
        } catch (error) {
            console.error('Error promoting member:', error);
            alert('Failed to promote member. Please try again.');
        }
    };

    const handleRemoveMember = async (memberId, userId) => {
        if (!isCurrentUserAdmin) {
            alert('Only admins can remove members.');
            return;
        }

        if (!confirm('Remove this member from the family? Their expenses will be reassigned to you.')) return;

        try {
            // Delete the member
            const { error } = await supabase
                .from('family_members')
                .delete()
                .eq('family_id', currentFamily.id)
                .eq('user_id', userId);

            if (error) throw error;
            await fetchFamilyMembers();
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member. Please try again.');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };


    const handleCreateFamily = async (e) => {
        e.preventDefault();
        if (!newFamilyName.trim()) return;

        try {
            await createFamily(newFamilyName.trim());
            setNewFamilyName('');
            setShowAddFamilyModal(false);
        } catch (error) {
            console.error('Error creating family:', error);
            alert('Failed to create family');
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        try {
            await addCategory({
                name: newCategoryName.trim(),
                icon: newCategoryIcon || '📦',
                type: newCategoryType
            });
            setNewCategoryName('');
            setNewCategoryIcon('');
            setShowAddCategoryModal(false);
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    const handleDeleteFamily = async () => {
        if (!currentFamily || !isCurrentUserAdmin) return;

        const confirmMessage = `Are you sure you want to delete "${currentFamily.name}"?\n\nThis will permanently delete:\n- All expenses and incomes\n- All budgets\n- All categories and payment methods\n- All family members\n\nThis action cannot be undone!`;

        if (!confirm(confirmMessage)) return;

        // Double confirmation
        const finalConfirm = prompt(`Type "${currentFamily.name}" to confirm deletion:`);
        if (finalConfirm !== currentFamily.name) {
            alert('Family name did not match. Deletion cancelled.');
            return;
        }

        try {
            await deleteFamily(currentFamily.id);
            alert('Family deleted successfully.');
        } catch (error) {
            console.error('Error deleting family:', error);
            alert('Failed to delete family. Please try again.');
        }
    };

    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setNewCategoryName(category.name);
        setNewCategoryIcon(category.icon);
        setNewCategoryType(category.type);
        setShowEditCategoryModal(true);
    };

    const handleUpdateCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim() || !newCategoryIcon || !editingCategory) return;

        try {
            await updateCategory(editingCategory.id, {
                name: newCategoryName,
                icon: newCategoryIcon,
                type: newCategoryType
            });

            // Reset form and close modal
            setShowEditCategoryModal(false);
            setEditingCategory(null);
            setNewCategoryName('');
            setNewCategoryIcon('');
            setNewCategoryType('expense');
        } catch (error) {
            console.error('Error updating category:', error);
            alert('Failed to update category. Please try again.');
        }
    };

    const handleDeleteCategory = async (id) => {
        const categoryToDelete = categories.find(c => c.id === id);
        const warningMessage = `Are you sure you want to delete "${categoryToDelete?.name}"?\n\nWARNING: This may affect expenses associated with this category.`;

        if (!confirm(warningMessage)) return;

        try {
            await deleteCategory(id);
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const handleAddPaymentMethod = async (e) => {
        e.preventDefault();
        if (!newPaymentName.trim()) return;

        try {
            await addPaymentMethod({
                name: newPaymentName.trim(),
                type: newPaymentType
            });
            setNewPaymentName('');
            setShowAddPaymentModal(false);
        } catch (error) {
            console.error('Error adding payment method:', error);
        }
    };

    const handleEditPayment = (payment) => {
        setEditingPayment(payment);
        setNewPaymentName(payment.name);
        setNewPaymentType(payment.type);
        setShowEditPaymentModal(true);
    };

    const handleUpdatePayment = async (e) => {
        e.preventDefault();
        if (!newPaymentName.trim() || !editingPayment) return;

        try {
            await updatePaymentMethod(editingPayment.id, {
                name: newPaymentName,
                type: newPaymentType
            });

            // Reset form and close modal
            setShowEditPaymentModal(false);
            setEditingPayment(null);
            setNewPaymentName('');
            setNewPaymentType('bank');
        } catch (error) {
            console.error('Error updating payment method:', error);
            alert('Failed to update payment method. Please try again.');
        }
    };

    const handleDeletePaymentMethod = async (id) => {
        const paymentToDelete = paymentMethods.find(p => p.id === id);
        const warningMessage = `Are you sure you want to delete "${paymentToDelete?.name}"?\n\nWARNING: This may affect expenses associated with this payment method.`;

        if (!confirm(warningMessage)) return;

        try {
            await deletePaymentMethod(id);
        } catch (error) {
            console.error('Error deleting payment method:', error);
        }
    };

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    const familyOptions = families.map(f => ({
        value: f.id,
        label: f.name
    }));

    const expenseCategories = categories.filter(c => c.type === 'expense');
    const incomeCategories = categories.filter(c => c.type === 'income');

    // Check if current user is admin of the current family
    const currentUserMember = familyMembers.find(m => m.user_id === user?.id);
    const isCurrentUserAdmin = currentUserMember?.role === 'admin';

    return (
        <div className="settings">
            <h1 className="settings-title">Settings</h1>

            {/* Profile Section */}
            <Card className="settings-section">
                <h2 className="settings-section-title">👤 Profile</h2>
                <div className="profile-info">
                    <p><strong>Email:</strong> {user?.email}</p>
                </div>
                <Button variant="danger" onClick={handleLogout}>
                    Sign Out
                </Button>
            </Card>

            {/* No Family Welcome - Show when user has no families */}
            {families.length === 0 ? (
                <Card className="settings-section">
                    <h2 className="settings-section-title">👋 Welcome!</h2>
                    <div className="settings-subsection">
                        <h3>Get Started</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            Choose how you'd like to use the budget tracker:
                        </p>

                        <div className="onboarding-options">
                            <Card className="onboarding-card" hover>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>👨‍👩‍👧‍👦</div>
                                <h3>Create Workspace</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                    Start tracking your expenses and income
                                </p>
                                <form onSubmit={handleCreateFamily} className="settings-form">
                                    <Input
                                        value={newFamilyName}
                                        onChange={(e) => setNewFamilyName(e.target.value)}
                                        placeholder="Personal workspace"
                                        icon="📝"
                                    />
                                    <Button type="submit" variant="primary">
                                        Create Workspace
                                    </Button>
                                </form>
                            </Card>

                            <Card className="onboarding-card" hover>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✉️</div>
                                <h3>Join Existing Family</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                    Ask a family admin to add you by sharing your email:
                                </p>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-primary)',
                                    wordBreak: 'break-all'
                                }}>
                                    {user?.email}
                                </div>
                            </Card>
                        </div>
                    </div>
                </Card>
            ) : (
                /* Family Management - Show when user has families */
                <Card className="settings-section">
                    <h2 className="settings-section-title">👨‍👩‍👧‍👦 Family</h2>

                    <div className="settings-subsection">
                        <h3>Current Family</h3>
                        <Select
                            value={currentFamily?.id}
                            onChange={(id) => {
                                const family = families.find(f => f.id === id);
                                if (family) switchFamily(family);
                            }}
                            options={familyOptions}
                            icon="👨‍👩‍👧‍👦"
                        />
                    </div>

                    <div className="settings-subsection">
                        <h3>Create New Family</h3>
                        <Button
                            variant="primary"
                            onClick={() => setShowAddFamilyModal(true)}
                        >
                            ➕ Create Family
                        </Button>
                    </div>

                    {/* Delete Family - Admin Only */}
                    {isCurrentUserAdmin && (
                        <div className="settings-subsection">
                            <h3>Danger Zone</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                                Deleting the family will permanently remove all data.
                            </p>
                            <Button
                                variant="danger"
                                onClick={handleDeleteFamily}
                            >
                                🗑️ Delete Family
                            </Button>
                        </div>
                    )}

                    {/* Family Members Section */}
                    <div className="settings-subsection">
                        <h3>Family Members</h3>
                        {loadingMembers ? (
                            <LoadingSpinner />
                        ) : (
                            <div className="items-list">
                                {familyMembers.map(member => {
                                    const isCurrentUser = member.user_id === user?.id;
                                    const isAdmin = member.role === 'admin';

                                    return (
                                        <div key={member.id} className="item-row member-row">
                                            <div className="member-info">
                                                <span className="member-name">
                                                    {member.profiles?.email || 'Unknown'}
                                                    {isCurrentUser && <span className="member-tag">(You)</span>}
                                                </span>
                                                <span className={`member-role ${isAdmin ? 'member-role--admin' : ''}`}>
                                                    {isAdmin ? '👑 Admin' : '👤 Member'}
                                                </span>
                                            </div>
                                            {!isCurrentUser && isCurrentUserAdmin && (
                                                <div className="member-actions">
                                                    {!isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handlePromoteToAdmin(member.id, member.user_id)}
                                                        >
                                                            ⬆️ Promote
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveMember(member.id, member.user_id)}
                                                    >
                                                        🗑️ Remove
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isCurrentUserAdmin && (
                        <div className="settings-subsection">
                            <h3>Add Family Member</h3>
                            <Button
                                variant="primary"
                                onClick={() => setShowAddMemberModal(true)}
                            >
                                ➕ Add Member
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            {/* Categories Management - Only show when family exists */}
            {currentFamily && (
                <Card className="settings-section">
                    <h2 className="settings-section-title">📂 Categories</h2>

                    <div className="settings-subsection">
                        <h3>Expense Categories</h3>
                        <div className="items-list">
                            {expenseCategories.map(cat => (
                                <div key={cat.id} className="item-row">
                                    <span className="item-icon">{cat.icon}</span>
                                    <span className="item-name">{cat.name}</span>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditCategory(cat)}
                                        >
                                            ✏️
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteCategory(cat.id)}
                                        >
                                            🗑️
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="settings-subsection">
                        <h3>Income Categories</h3>
                        <div className="items-list">
                            {incomeCategories.map(cat => (
                                <div key={cat.id} className="item-row">
                                    <span className="item-icon">{cat.icon}</span>
                                    <span className="item-name">{cat.name}</span>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditCategory(cat)}
                                        >
                                            ✏️
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteCategory(cat.id)}
                                        >
                                            🗑️
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="settings-subsection">
                        <h3>Add Category</h3>
                        <Button
                            variant="primary"
                            onClick={() => setShowAddCategoryModal(true)}
                        >
                            ➕ Add Category
                        </Button>
                    </div>
                </Card>
            )}

            {/* Payment Methods - Only show when family exists */}
            {currentFamily && (
                <Card className="settings-section">
                    <h2 className="settings-section-title">💳 Payment Methods</h2>

                    <div className="settings-subsection">
                        <h3>Your Payment Methods</h3>
                        <div className="items-list">
                            {paymentMethods.map(pm => (
                                <div key={pm.id} className="item-row">
                                    <span className="item-name">{pm.name}</span>
                                    <span className="item-badge">{pm.type}</span>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditPayment(pm)}
                                        >
                                            ✏️
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeletePaymentMethod(pm.id)}
                                        >
                                            🗑️
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="settings-subsection">
                        <h3>Add Payment Method</h3>
                        <Button
                            variant="primary"
                            onClick={() => setShowAddPaymentModal(true)}
                        >
                            ➕ Add Payment Method
                        </Button>
                    </div>
                </Card>
            )}

            {/* Modals */}
            <Modal
                isOpen={showAddFamilyModal}
                onClose={() => setShowAddFamilyModal(false)}
                title="Create New Family"
            >
                <form onSubmit={handleCreateFamily} className="settings-form">
                    <Input
                        value={newFamilyName}
                        onChange={(e) => setNewFamilyName(e.target.value)}
                        placeholder="Family name..."
                        icon="📝"
                        required
                    />
                    <Button type="submit" variant="primary">
                        Create Family
                    </Button>
                </form>
            </Modal>

            <Modal
                isOpen={showAddMemberModal}
                onClose={() => setShowAddMemberModal(false)}
                title="Add Family Member"
            >
                <form onSubmit={handleAddMember} className="settings-form">
                    <Input
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="Member's email address..."
                        icon="✉️"
                        required
                    />
                    <Button type="submit" variant="primary">
                        Add Member
                    </Button>
                    <p className="settings-hint">
                        💡 The user must have signed up before you can add them to your family.
                    </p>
                </form>
            </Modal>

            <Modal
                isOpen={showAddCategoryModal}
                onClose={() => setShowAddCategoryModal(false)}
                title="Add Category"
            >
                <form onSubmit={handleAddCategory} className="settings-form">
                    <EmojiPicker
                        label="Category Icon"
                        value={newCategoryIcon}
                        onChange={setNewCategoryIcon}
                    />
                    <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name..."
                        icon="📝"
                        required
                    />
                    <Select
                        value={newCategoryType}
                        onChange={setNewCategoryType}
                        options={[
                            { value: 'expense', label: 'Expense' },
                            { value: 'income', label: 'Income' }
                        ]}
                        icon="📊"
                    />
                    <Button type="submit" variant="primary">
                        Add Category
                    </Button>
                </form>
            </Modal>

            <Modal
                isOpen={showAddPaymentModal}
                onClose={() => setShowAddPaymentModal(false)}
                title="Add Payment Method"
            >
                <form onSubmit={handleAddPaymentMethod} className="settings-form">
                    <Input
                        value={newPaymentName}
                        onChange={(e) => setNewPaymentName(e.target.value)}
                        placeholder="Payment method name..."
                        icon="💳"
                        required
                    />
                    <Select
                        value={newPaymentType}
                        onChange={setNewPaymentType}
                        options={[
                            { value: 'bank', label: 'Bank Account' },
                            { value: 'credit_card', label: 'Credit Card' },
                            { value: 'cash', label: 'Cash' },
                            { value: 'other', label: 'Other' }
                        ]}
                        icon="📊"
                    />
                    <Button type="submit" variant="primary">
                        Add Payment Method
                    </Button>
                </form>
            </Modal>

            <Modal
                isOpen={showEditCategoryModal}
                onClose={() => {
                    setShowEditCategoryModal(false);
                    setEditingCategory(null);
                    setNewCategoryName('');
                    setNewCategoryIcon('');
                }}
                title="Edit Category"
            >
                <form onSubmit={handleUpdateCategory} className="settings-form">
                    <EmojiPicker
                        label="Category Icon"
                        value={newCategoryIcon}
                        onChange={setNewCategoryIcon}
                    />
                    <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name..."
                        icon="📝"
                        required
                    />
                    <Select
                        value={newCategoryType}
                        onChange={setNewCategoryType}
                        options={[
                            { value: 'expense', label: 'Expense' },
                            { value: 'income', label: 'Income' }
                        ]}
                        icon="📊"
                    />
                    <Button type="submit" variant="primary">
                        Update Category
                    </Button>
                </form>
            </Modal>

            <Modal
                isOpen={showEditPaymentModal}
                onClose={() => {
                    setShowEditPaymentModal(false);
                    setEditingPayment(null);
                    setNewPaymentName('');
                }}
                title="Edit Payment Method"
            >
                <form onSubmit={handleUpdatePayment} className="settings-form">
                    <Input
                        value={newPaymentName}
                        onChange={(e) => setNewPaymentName(e.target.value)}
                        placeholder="Payment method name..."
                        icon="💳"
                        required
                    />
                    <Select
                        value={newPaymentType}
                        onChange={setNewPaymentType}
                        options={[
                            { value: 'bank', label: 'Bank Account' },
                            { value: 'credit_card', label: 'Credit Card' },
                            { value: 'cash', label: 'Cash' },
                            { value: 'other', label: 'Other' }
                        ]}
                        icon="📊"
                    />
                    <Button type="submit" variant="primary">
                        Update Payment Method
                    </Button>
                </form>
            </Modal>
        </div>
    );
};

export default Settings;
