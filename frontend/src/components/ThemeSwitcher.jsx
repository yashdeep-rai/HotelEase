import React, { useState, useEffect } from 'react';
import {FiSun , FiMoon} from 'react-icons/fi';

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <button className="btn btn-sm" onClick={toggleTheme} >
      {theme === 'light' ? <FiMoon /> : <FiSun />}
      
    </button>
  );
};

export default ThemeSwitcher;
