import React, { useEffect, useLayoutEffect, useState } from 'react';
import style from './ThemeMode.module.css';

function getInitialTheme() {
    // Try to get from localStorage, else from body, else default to 'light'
    return (
        localStorage.getItem('selectedTheme') ||
        document.body.getAttribute('data-theme') ||
        'light'
    );
}

export default function ThemeMode() {
    const [theme, setTheme] = useState(getInitialTheme);

    // Set theme on body immediately on mount to prevent flash
    useLayoutEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('selectedTheme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    // Choose icon based on theme
    const iconClass = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    return (
        <button onClick={toggleTheme} type='button' className='btn'>
            <i id='toggleBtn' className={`${style.themeToggleButton} ${iconClass}`} />
        </button>
    );
}
