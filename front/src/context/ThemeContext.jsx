import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = {
  dark: 'dark',
  light: 'light'
};

export const ACCENT_COLORS = {
  cyan: { name: 'Cyan', value: '#64FFDA', class: 'accent-cyan' },
  purple: { name: 'Purple', value: '#A78BFA', class: 'accent-purple' },
  blue: { name: 'Blue', value: '#60A5FA', class: 'accent-blue' },
  green: { name: 'Green', value: '#34D399', class: 'accent-green' },
  orange: { name: 'Orange', value: '#FB923C', class: 'accent-orange' },
  pink: { name: 'Pink', value: '#F472B6', class: 'accent-pink' }
};

export const ThemeProvider = ({ children }) => {
  // Load saved preferences from localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('deepguard-theme');
    return saved || THEMES.dark;
  });
  
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('deepguard-accent');
    return saved || 'cyan';
  });

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem('deepguard-theme', theme);
  }, [theme]);

  // Apply accent color CSS variable
  useEffect(() => {
    const root = document.documentElement;
    const color = ACCENT_COLORS[accentColor];
    
    if (color) {
      root.style.setProperty('--color-primary', color.value);
      root.style.setProperty('--color-primary-rgb', hexToRgb(color.value));
    }
    
    // Save to localStorage
    localStorage.setItem('deepguard-accent', accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === THEMES.dark ? THEMES.light : THEMES.dark);
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    accentColor,
    setAccentColor,
    isDark: theme === THEMES.dark
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }
  return '100, 255, 218'; // Default cyan
}

export default ThemeContext;
