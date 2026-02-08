import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'md', fullScreen = false }) => {
    if (fullScreen) {
        return (
            <div className="spinner-fullscreen">
                <div className={`spinner spinner--${size}`}>
                    <div className="spinner-ring"></div>
                    <div className="spinner-ring"></div>
                    <div className="spinner-ring"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`spinner spinner--${size}`}>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
        </div>
    );
};

export default LoadingSpinner;
