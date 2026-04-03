import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

import { Home, ListOrdered, LayoutDashboard, Wallet, Settings } from 'lucide-react';

const Navbar = () => {
    const navItems = [
        { path: '/', label: 'Overview', icon: <Home size={24} strokeWidth={1.5} /> },
        { path: '/transactions', label: 'Transactions', icon: <ListOrdered size={24} strokeWidth={1.5} /> },
        { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={24} strokeWidth={1.5} /> },
        { path: '/budgets', label: 'Budgets', icon: <Wallet size={24} strokeWidth={1.5} /> },
        { path: '/settings', label: 'Settings', icon: <Settings size={24} strokeWidth={1.5} /> }
    ];

    return (
        <nav className="navbar">
            <div className="navbar-container">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                            `navbar-item ${isActive ? 'navbar-item--active' : ''}`
                        }
                    >
                        <div className="navbar-icon-container">
                            <span className="navbar-icon">{item.icon}</span>
                        </div>
                        <span className="navbar-label">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default Navbar;
