import React, { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import './EmojiPicker.css';

const EmojiPicker = ({ value, onChange, label, error }) => {
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

    const handleEmojiSelect = (emoji) => {
        onChange(emoji.native);
        setShowPicker(false);
    };

    return (
        <div className="emoji-picker-wrapper" ref={pickerRef}>
            {label && (
                <label className="emoji-picker-label">{label}</label>
            )}

            <div className="emoji-picker-container">
                <button
                    type="button"
                    className={`emoji-picker-button ${error ? 'emoji-picker-button--error' : ''}`}
                    onClick={() => setShowPicker(!showPicker)}
                >
                    <span className="emoji-picker-selected">
                        {value || '😀'}
                    </span>
                    <span className="emoji-picker-text">
                        {value ? 'Change Emoji' : 'Select Emoji'}
                    </span>
                </button>

                {showPicker && (
                    <div className="emoji-picker-dropdown">
                        <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme="dark"
                            previewPosition="none"
                            skinTonePosition="none"
                            searchPosition="top"
                            navPosition="bottom"
                            perLine={8}
                            maxFrequentRows={2}
                        />
                    </div>
                )}
            </div>

            {error && <span className="emoji-picker-error">{error}</span>}
        </div>
    );
};

export default EmojiPicker;
