import React from 'react';
import './Button.css';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    loading = false,
    icon = null,
    onClick,
    type = 'button',
    ...props
}) => {
    const classNames = [
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        disabled && 'btn--disabled',
        loading && 'btn--loading'
    ].filter(Boolean).join(' ');

    return (
        <button
            type={type}
            className={classNames}
            onClick={onClick}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="btn__loader"></span>
            ) : (
                <>
                    {icon && <span className="btn__icon">{icon}</span>}
                    <span className="btn__text">{children}</span>
                </>
            )}
        </button>
    );
};

export default Button;
