import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

const BudgetContext = createContext({});

export const useBudget = () => {
    const context = useContext(BudgetContext);
    if (!context) {
        throw new Error('useBudget must be used within BudgetProvider');
    }
    return context;
};

export const BudgetProvider = ({ children }) => {
    const { user } = useAuth();
    const [currentFamily, setCurrentFamily] = useState(null);
    const [families, setFamilies] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [incomes, setIncomes] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [wealthAssets, setWealthAssets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch all user families
    const fetchFamilies = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('family_members')
                .select('family_id, role, families(*)')
                .eq('user_id', user.id);

            if (error) throw error;

            const familyList = data.map(fm => ({
                ...fm.families,
                userRole: fm.role
            }));

            setFamilies(familyList);

            // Set current family if not set
            if (!currentFamily && familyList.length > 0) {
                // Try to load saved family ID from localStorage
                const savedFamilyId = localStorage.getItem('selectedFamilyId');
                let familyToSet = familyList[0];

                if (savedFamilyId) {
                    const savedFamily = familyList.find(f => f.id === savedFamilyId);
                    if (savedFamily) {
                        familyToSet = savedFamily;
                    }
                }

                setCurrentFamily(familyToSet);
            } else if (familyList.length === 0) {
                // No families, stop loading
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching families:', error);
            setLoading(false);
        }
    };

    // Fetch family data
    const fetchFamilyData = async (familyId) => {
        if (!familyId) return;

        try {
            setLoading(true);

            // Fetch expenses
            const { data: expensesData, error: expensesError } = await supabase
                .from('expenses')
                .select('*, categories(*), payment_methods(*), profiles(*)')
                .eq('family_id', familyId)
                .order('transaction_date', { ascending: false });

            if (expensesError) throw expensesError;
            setExpenses(expensesData || []);

            // Fetch incomes
            const { data: incomesData, error: incomesError } = await supabase
                .from('incomes')
                .select('*, profiles(*)')
                .eq('family_id', familyId)
                .order('date', { ascending: false });

            if (incomesError) throw incomesError;
            setIncomes(incomesData || []);

            // Fetch budgets
            const { data: budgetsData, error: budgetsError } = await supabase
                .from('budgets')
                .select('*')
                .eq('family_id', familyId)
                .order('start_date', { ascending: false });

            if (budgetsError) throw budgetsError;
            setBudgets(budgetsData || []);

            // Fetch categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select('*')
                .eq('family_id', familyId)
                .order('name');

            if (categoriesError) throw categoriesError;
            setCategories(categoriesData || []);

            // Fetch payment methods
            const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
                .from('payment_methods')
                .select('*')
                .eq('family_id', familyId)
                .order('name');

            if (paymentMethodsError) throw paymentMethodsError;
            setPaymentMethods(paymentMethodsData || []);

            // Fetch wealth assets
            await fetchWealthAssets(familyId);
        } catch (error) {
            console.error('Error fetching family data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch categories only
    const fetchCategories = async (familyId) => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .eq('family_id', familyId)
                .order('name');

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    // Fetch payment methods only
    const fetchPaymentMethods = async (familyId) => {
        try {
            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .eq('family_id', familyId)
                .order('name');

            if (error) throw error;
            setPaymentMethods(data || []);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
        }
    };

    // Fetch expenses only
    const fetchExpenses = async (familyId) => {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*, categories(*), payment_methods(*), profiles(*)')
                .eq('family_id', familyId)
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            setExpenses(data || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        }
    };

    // Fetch incomes only
    const fetchIncomes = async (familyId) => {
        try {
            const { data, error } = await supabase
                .from('incomes')
                .select('*, profiles(*)')
                .eq('family_id', familyId)
                .order('date', { ascending: false });

            if (error) throw error;
            setIncomes(data || []);
        } catch (error) {
            console.error('Error fetching incomes:', error);
        }
    };

    // Fetch wealth assets - simplified model
    // My Wealth: User's own assets
    // Family Wealth: Assets from current family members shared with user
    const fetchWealthAssets = async (familyId) => {
        if (!user) return;

        try {
            // Fetch user's own assets
            const { data: ownAssets, error: ownError } = await supabase
                .from('wealth_assets')
                .select(`
                    *,
                    wealth_sharing(*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ownError) throw ownError;

            // Get all members of current family
            const { data: familyMembers } = await supabase
                .from('family_members')
                .select('user_id')
                .eq('family_id', familyId);

            const familyMemberIds = familyMembers?.map(m => m.user_id).filter(id => id !== user.id) || [];

            console.log('Current Family Members (excluding me):', familyMemberIds);

            // Get shared assets using JOIN to bypass RLS
            // Instead of: get asset_ids, then fetch assets (blocked by RLS)
            // Do: join wealth_sharing with wealth_assets in one query
            const { data: sharedAssetsData, error: sharedError } = await supabase
                .from('wealth_sharing')
                .select(`
                    asset_id,
                    wealth_assets (
                        id,
                        user_id,
                        asset_type,
                        asset_name,
                        invested_amount,
                        current_amount,
                        maturity_amount,
                        maturity_date,
                        notes,
                        created_at,
                        updated_at
                    )
                `)
                .eq('shared_with_user_id', user.id);

            if (sharedError) {
                console.error('Error fetching shared assets:', sharedError);
            }

            console.log('Shared assets raw data:', sharedAssetsData);

            let sharedAssets = [];
            if (sharedAssetsData && sharedAssetsData.length > 0) {
                // Extract the wealth_assets data from the join
                const assetsFromSharing = sharedAssetsData
                    .map(s => s.wealth_assets)
                    .filter(asset => asset !== null); // Filter out null assets

                console.log('===== SHARED ASSETS DEBUG =====');
                console.log('Number of shared assets fetched:', assetsFromSharing.length);
                console.log('Full asset objects:', assetsFromSharing);

                if (assetsFromSharing.length > 0) {
                    assetsFromSharing.forEach((asset, idx) => {
                        console.log(`Asset ${idx}:`, {
                            id: asset.id,
                            name: asset.asset_name,
                            owner_user_id: asset.user_id
                        });
                    });
                }
                console.log('Current family member IDs:', familyMemberIds);

                // Filter to only show assets from current family members
                const familyFiltered = assetsFromSharing.filter(asset => {
                    const isInFamily = familyMemberIds.includes(asset.user_id);
                    console.log(`Checking asset ${asset.id} (${asset.asset_name}): owner=${asset.user_id}, isInFamily=${isInFamily}`);
                    return isInFamily;
                });
                console.log('Total assets after family filter:', familyFiltered.length);
                console.log('===== END DEBUG =====');

                // Fetch owner emails
                if (familyFiltered && familyFiltered.length > 0) {
                    const userIds = [...new Set(familyFiltered.map(a => a.user_id))];
                    const { data: profilesData } = await supabase
                        .from('profiles')
                        .select('id, email')
                        .in('id', userIds);

                    const profilesMap = {};
                    if (profilesData) {
                        profilesData.forEach(p => {
                            profilesMap[p.id] = p;
                        });
                    }

                    sharedAssets = familyFiltered.map(asset => ({
                        ...asset,
                        profiles: profilesMap[asset.user_id]
                    }));
                }
            }

            // Combine and mark ownership
            const combined = [
                ...(ownAssets || []).map(asset => ({ ...asset, isOwner: true })),
                ...(sharedAssets || []).map(asset => ({ ...asset, isOwner: false }))
            ];

            setWealthAssets(combined);
        } catch (error) {
            console.error('Error fetching wealth assets:', error);
        }
    };

    // Add wealth asset
    const addWealthAsset = async (asset, sharedWithUserIds = []) => {
        try {
            const { data, error } = await supabase
                .from('wealth_assets')
                .insert([{
                    ...asset,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;

            // Add sharing records
            if (sharedWithUserIds.length > 0) {
                const sharingRecords = sharedWithUserIds.map(userId => ({
                    asset_id: data.id,
                    shared_with_user_id: userId
                }));

                const { error: sharingError } = await supabase
                    .from('wealth_sharing')
                    .insert(sharingRecords);

                if (sharingError) throw sharingError;
            }

            await fetchWealthAssets(currentFamily.id);
            return data;
        } catch (error) {
            console.error('Error adding wealth asset:', error);
            throw error;
        }
    };

    // Update wealth asset
    const updateWealthAsset = async (assetId, updates, sharedWithUserIds = null) => {
        try {
            const { error } = await supabase
                .from('wealth_assets')
                .update(updates)
                .eq('id', assetId);

            if (error) throw error;

            // Update sharing if provided
            if (sharedWithUserIds !== null) {
                // Delete existing shares
                await supabase
                    .from('wealth_sharing')
                    .delete()
                    .eq('asset_id', assetId);

                // Add new shares
                if (sharedWithUserIds.length > 0) {
                    const sharingRecords = sharedWithUserIds.map(userId => ({
                        asset_id: assetId,
                        shared_with_user_id: userId
                    }));

                    const { error: sharingError } = await supabase
                        .from('wealth_sharing')
                        .insert(sharingRecords);

                    if (sharingError) throw sharingError;
                }
            }

            await fetchWealthAssets(currentFamily.id);
        } catch (error) {
            console.error('Error updating wealth asset:', error);
            throw error;
        }
    };

    // Delete wealth asset
    const deleteWealthAsset = async (assetId) => {
        try {
            const { error } = await supabase
                .from('wealth_assets')
                .delete()
                .eq('id', assetId);

            if (error) throw error;
            await fetchWealthAssets(currentFamily.id);
        } catch (error) {
            console.error('Error deleting wealth asset:', error);
            throw error;
        }
    };

    // Create family
    const createFamily = async (familyName) => {
        try {
            const { data, error } = await supabase.rpc('create_family_group', {
                name_input: familyName
            });

            if (error) throw error;

            // Create default categories
            const defaultCategories = [
                { name: 'Food & Dining', icon: '🍔', type: 'expense' },
                { name: 'Transportation', icon: '🚗', type: 'expense' },
                { name: 'Shopping', icon: '🛍️', type: 'expense' },
                { name: 'Entertainment', icon: '🎬', type: 'expense' },
                { name: 'Bills & Utilities', icon: '💡', type: 'expense' },
                { name: 'Healthcare', icon: '🏥', type: 'expense' },
                { name: 'Salary', icon: '💼', type: 'income' },
                { name: 'Freelance', icon: '💻', type: 'income' },
                { name: 'Investments', icon: '📈', type: 'income' },
            ];

            const categoriesWithFamily = defaultCategories.map(cat => ({
                ...cat,
                family_id: data
            }));

            await supabase.from('categories').insert(categoriesWithFamily);

            // Create default payment methods
            const defaultPaymentMethods = [
                { name: 'Cash', type: 'cash' },
                { name: 'Credit Card', type: 'credit_card' },
                { name: 'Bank Account', type: 'bank' },
            ];

            const paymentMethodsWithFamily = defaultPaymentMethods.map(pm => ({
                ...pm,
                family_id: data
            }));

            await supabase.from('payment_methods').insert(paymentMethodsWithFamily);

            await fetchFamilies();
            return data;
        } catch (error) {
            console.error('Error creating family:', error);
            throw error;
        }
    };

    // Delete family
    const deleteFamily = async (familyId) => {
        try {
            console.log('Attempting to delete family:', familyId);

            // Delete the family (cascade delete should handle related records)
            const { data, error } = await supabase
                .from('families')
                .delete()
                .eq('id', familyId)
                .select();

            console.log('Delete response:', { data, error });

            if (error) {
                console.error('Delete error:', error);
                throw error;
            }

            // Check if delete actually happened
            if (!data || data.length === 0) {
                throw new Error('No family was deleted. You may not have permission to delete this family.');
            }

            // Clear current family if it was deleted
            if (currentFamily?.id === familyId) {
                setCurrentFamily(null);
                setExpenses([]);
                setIncomes([]);
                setBudgets([]);
                setCategories([]);
                setPaymentMethods([]);
            }

            // Refetch families and switch to first available
            await fetchFamilies();

            return true;
        } catch (error) {
            console.error('Error deleting family:', error);
            throw error;
        }
    };

    // Switch family
    const switchFamily = async (family) => {
        setCurrentFamily(family);
        // Save selected family to localStorage
        if (family?.id) {
            localStorage.setItem('selectedFamilyId', family.id);
        }
    };

    // Add expense
    const addExpense = async (expenseData) => {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .insert([{
                    ...expenseData,
                    family_id: currentFamily.id,
                    user_id: user.id
                }])
                .select('*, categories(*), payment_methods(*)')
                .single();

            if (error) throw error;
            setExpenses([data, ...expenses]);
            return data;
        } catch (error) {
            console.error('Error adding expense:', error);
            throw error;
        }
    };

    // Update expense
    const updateExpense = async (id, expenseData) => {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .update(expenseData)
                .eq('id', id)
                .select('*, categories(*), payment_methods(*)')
                .single();

            if (error) throw error;
            setExpenses(expenses.map(e => e.id === id ? data : e));
            return data;
        } catch (error) {
            console.error('Error updating expense:', error);
            throw error;
        }
    };

    // Delete expense
    const deleteExpense = async (id) => {
        try {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Refresh expenses from database
            if (currentFamily) {
                await fetchExpenses(currentFamily.id);
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    };

    // Add income
    const addIncome = async (incomeData) => {
        try {
            const { data, error } = await supabase
                .from('incomes')
                .insert([{
                    ...incomeData,
                    family_id: currentFamily.id,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;
            setIncomes([data, ...incomes]);
            return data;
        } catch (error) {
            console.error('Error adding income:', error);
            throw error;
        }
    };

    // Update income
    const updateIncome = async (id, incomeData) => {
        try {
            const { error } = await supabase
                .from('incomes')
                .update(incomeData)
                .eq('id', id);

            if (error) throw error;

            // Refresh incomes from database
            if (currentFamily) {
                await fetchIncomes(currentFamily.id);
            }
        } catch (error) {
            console.error('Error updating income:', error);
            throw error;
        }
    };

    // Delete income
    const deleteIncome = async (id) => {
        try {
            const { error } = await supabase
                .from('incomes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Refresh incomes from database
            if (currentFamily) {
                await fetchIncomes(currentFamily.id);
            }
        } catch (error) {
            console.error('Error deleting income:', error);
            throw error;
        }
    };

    // Add/Update budget
    const saveBudget = async (budgetData) => {
        try {
            const { data, error } = await supabase
                .from('budgets')
                .upsert([{
                    ...budgetData,
                    family_id: currentFamily.id,
                    created_by: user.id
                }])
                .select()
                .single();

            if (error) throw error;

            // Update budgets list
            const exists = budgets.find(b => b.id === data.id);
            if (exists) {
                setBudgets(budgets.map(b => b.id === data.id ? data : b));
            } else {
                setBudgets([data, ...budgets]);
            }

            return data;
        } catch (error) {
            console.error('Error saving budget:', error);
            throw error;
        }
    };

    // Add category
    const addCategory = async (categoryData) => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .insert([{
                    ...categoryData,
                    family_id: currentFamily.id
                }])
                .select()
                .single();

            if (error) throw error;
            setCategories([...categories, data]);
            return data;
        } catch (error) {
            console.error('Error adding category:', error);
            throw error;
        }
    };

    // Update category
    const updateCategory = async (id, updates) => {
        try {
            const { error } = await supabase
                .from('categories')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Refresh categories from database
            if (currentFamily) {
                await fetchCategories(currentFamily.id);
            }
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    };

    // Delete category
    const deleteCategory = async (id) => {
        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Refresh categories from database
            if (currentFamily) {
                await fetchCategories(currentFamily.id);
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    };

    // Add payment method
    const addPaymentMethod = async (paymentMethodData) => {
        try {
            const { data, error } = await supabase
                .from('payment_methods')
                .insert([{
                    ...paymentMethodData,
                    family_id: currentFamily.id
                }])
                .select()
                .single();

            if (error) throw error;
            setPaymentMethods([...paymentMethods, data]);
            return data;
        } catch (error) {
            console.error('Error adding payment method:', error);
            throw error;
        }
    };

    // Update payment method
    const updatePaymentMethod = async (id, updates) => {
        try {
            const { error } = await supabase
                .from('payment_methods')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Refresh payment methods from database
            if (currentFamily) {
                await fetchPaymentMethods(currentFamily.id);
            }
        } catch (error) {
            console.error('Error updating payment method:', error);
            throw error;
        }
    };

    // Delete payment method
    const deletePaymentMethod = async (id) => {
        try {
            const { error } = await supabase
                .from('payment_methods')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Refresh payment methods from database
            if (currentFamily) {
                await fetchPaymentMethods(currentFamily.id);
            }
        } catch (error) {
            console.error('Error deleting payment method:', error);
            throw error;
        }
    };

    // Refresh current family data
    const refreshData = () => {
        if (currentFamily) {
            fetchFamilyData(currentFamily.id);
        }
    };

    // Initialize
    useEffect(() => {
        if (user) {
            fetchFamilies();
        } else {
            setFamilies([]);
            setCurrentFamily(null);
        }
    }, [user]);

    // Load family data when current family changes
    useEffect(() => {
        if (currentFamily) {
            fetchFamilyData(currentFamily.id);
        } else {
            // No current family, stop loading
            setLoading(false);
        }
    }, [currentFamily?.id]);

    const value = {
        currentFamily,
        families,
        expenses,
        incomes,
        budgets,
        categories,
        paymentMethods,
        loading,
        createFamily,
        deleteFamily,
        switchFamily,
        addExpense,
        updateExpense,
        deleteExpense,
        addIncome,
        updateIncome,
        deleteIncome,
        saveBudget,
        addCategory,
        updateCategory,
        deleteCategory,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        wealthAssets,
        fetchWealthAssets,
        addWealthAsset,
        updateWealthAsset,
        deleteWealthAsset,
        refreshData
    };

    return (
        <BudgetContext.Provider value={value}>
            {children}
        </BudgetContext.Provider>
    );
};
