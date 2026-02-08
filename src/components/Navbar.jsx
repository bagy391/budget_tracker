import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const navItems = [
        { path: '/', label: 'Overview', icon: '🏠' },
        { path: '/transactions', label: 'Transactions', icon: '📝' },
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/budgets', label: 'Budgets', icon: '💰' },
        { path: '/settings', label: 'Settings', icon: '⚙️' }
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
                        <span className="navbar-icon">{item.icon}</span>
                        <span className="navbar-label">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default Navbar;
