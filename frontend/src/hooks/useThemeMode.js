import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'lockin.theme';

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme !== 'light';
};

const useThemeMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return {
    isDarkMode,
    setIsDarkMode,
  };
};

export default useThemeMode;
