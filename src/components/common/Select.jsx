import React, { useState, useRef, useEffect } from 'react';
import './Select.css';

const Select = ({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    error,
    icon,
    disabled = false,
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
    };

    const selectedOption = options.find(opt =>
        typeof opt === 'object' ? opt.value === value : opt === value
    );

    const getDisplayText = () => {
        if (!selectedOption) return placeholder;
        return typeof selectedOption === 'object' ? selectedOption.label : selectedOption;
    };

    const getOptionValue = (opt) => typeof opt === 'object' ? opt.value : opt;
    const getOptionLabel = (opt) => typeof opt === 'object' ? opt.label : opt;
    const getOptionIcon = (opt) => typeof opt === 'object' ? opt.icon : null;

    return (
        <div className="select-wrapper" ref={selectRef}>
            {label && (
                <label className="select-label">
                    {label}
                    {required && <span className="select-required">*</span>}
                </label>
            )}
            <div
                className={`select-container ${isOpen ? 'select-container--open' : ''} ${error ? 'select-container--error' : ''} ${disabled ? 'select-container--disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                {icon && <span className="select-icon">{icon}</span>}
                <span className={`select-value ${!selectedOption ? 'select-value--placeholder' : ''}`}>
                    {selectedOption && getOptionIcon(selectedOption) && (
                        <span className="select-value-icon">{getOptionIcon(selectedOption)}</span>
                    )}
                    {getDisplayText()}
                </span>
                <span className={`select-arrow ${isOpen ? 'select-arrow--open' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <div className="select-dropdown">
                    {options.length === 0 ? (
                        <div className="select-option select-option--empty">No options available</div>
                    ) : (
                        options.map((option, index) => {
                            const optValue = getOptionValue(option);
                            const optLabel = getOptionLabel(option);
                            const optIcon = getOptionIcon(option);
                            const isSelected = value === optValue;

                            return (
                                <div
                                    key={index}
                                    className={`select-option ${isSelected ? 'select-option--selected' : ''}`}
                                    onClick={() => handleSelect(optValue)}
                                >
                                    {optIcon && <span className="select-option-icon">{optIcon}</span>}
                                    <span className="select-option-label">{optLabel}</span>
                                    {isSelected && <span className="select-option-check">✓</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {error && <span className="select-error">{error}</span>}
        </div>
    );
};

export default Select;
