import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BudgetProvider } from './contexts/BudgetContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import FamilyOnboarding from './pages/FamilyOnboarding';
import Overview from './pages/Overview';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import Budget from './pages/Budget';
import Settings from './pages/Settings';
import LoadingSpinner from './components/common/LoadingSpinner';

const AppRoutes = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <Routes>
            {/* Public routes */}
            <Route
                path="/login"
                element={!user ? <Login /> : <Navigate to="/" replace />}
            />
            <Route
                path="/signup"
                element={!user ? <Signup /> : <Navigate to="/" replace />}
            />

            {/* Onboarding route */}
            <Route
                path="/onboarding"
                element={
                    <ProtectedRoute>
                        <FamilyOnboarding />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Overview />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="budgets" element={<Budget />} />
                <Route path="settings" element={<Settings />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <BudgetProvider>
                    <AppRoutes />
                </BudgetProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
