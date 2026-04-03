import React, { useState, useRef, useEffect } from 'react';
import DynamicIcon from './DynamicIcon';
import './IconPicker.css';

const COMMON_ICONS = [
    'ShoppingCart', 'Coffee', 'Car', 'Home', 'Heart', 'Zap', 'Briefcase', 'Gift', 
    'Utensils', 'Wifi', 'Smartphone', 'Plane', 'Music', 'Book', 'Video', 'Users', 
    'Monitor', 'Shirt', 'Smile', 'Star', 'Check', 'Truck', 'Sun', 'Moon', 
    'Dumbbell', 'Droplets', 'Camera', 'Ticket', 'Scissors', 'Bus', 'Baby', 
    'Cat', 'Dog', 'Gamepad2', 'GraduationCap', 'Hammer', 'Medal', 'Palette',
    'Pill', 'Pizza', 'Train', 'Umbrella', 'Wrench', 'Activity', 'Anchor'
];

const IconPicker = ({ value, onChange, label, error }) => {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleIconSelect = (iconName) => {
        onChange(iconName);
        setShowPicker(false);
    };

    return (
        <div className="icon-picker-wrapper" ref={pickerRef}>
            {label && (
                <label className="icon-picker-label">{label}</label>
            )}

            <div className="icon-picker-container">
                <button
                    type="button"
                    className={`icon-picker-button ${error ? 'icon-picker-button--error' : ''}`}
                    onClick={() => setShowPicker(!showPicker)}
                >
                    <span className="icon-picker-selected" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DynamicIcon name={value || 'HelpCircle'} size={24} />
                    </span>
                    <span className="icon-picker-text">
                        {value ? 'Change Icon' : 'Select Icon'}
                    </span>
                </button>

                {showPicker && (
                    <div className="icon-picker-dropdown">
                        <div className="icon-picker-grid">
                            {COMMON_ICONS.map((iconName) => (
                                <button
                                    key={iconName}
                                    type="button"
                                    className={`icon-picker-item ${value === iconName ? 'icon-picker-item--active' : ''}`}
                                    onClick={() => handleIconSelect(iconName)}
                                    title={iconName}
                                >
                                    <DynamicIcon name={iconName} size={20} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {error && <span className="icon-picker-error">{error}</span>}
        </div>
    );
};

export default IconPicker;
