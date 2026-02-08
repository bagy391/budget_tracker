import React from 'react';
import './Card.css';

const Card = ({ children, className = '', hover = true, onClick, ...props }) => {
    const classNames = [
        'card',
        hover && 'card--hover',
        onClick && 'card--clickable',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classNames} onClick={onClick} {...props}>
            {children}
        </div>
    );
};

export default Card;
