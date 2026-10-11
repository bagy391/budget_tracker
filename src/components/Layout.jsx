import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import FloatingAIAssistant from './ai/FloatingAIAssistant';
import './Layout.css';

const Layout = () => {
    return (
        <div className="layout">
            <Navbar />
            <main className="layout-content">
                <Outlet />
            </main>
            <FloatingAIAssistant />
        </div>
    );
};

export default Layout;

