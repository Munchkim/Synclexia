// src/context/AppSettings.tsx
import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react';

type FontSize = 'small' | 'medium' | 'large';

interface SettingsContextProps {
  fontSize: FontSize;
  fontFamily: string;
  bgColor: string;
  accentColor: string;
  setFontSize: (size: FontSize) => void;
  setFontFamily: (font: string) => void;
  setColors: (bg: string, accent: string) => void;
}

const defaultSettings: SettingsContextProps = {
  fontSize: 'medium',
  fontFamily: 'Open Dyslexic',
  bgColor: '#fff9c4',
  accentColor: '#fde695',
  setFontSize: () => {},
  setFontFamily: () => {},
  setColors: () => {},
};

const AppSettingsContext = createContext<SettingsContextProps>(defaultSettings);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [fontFamily, setFontFamily] = useState('Open Dyslexic');
  const [bgColor, setBgColor] = useState('#fff9c4');
  const [accentColor, setAccentColor] = useState('#fde695');

  const setColors = useCallback((bg: string, accent: string) => {
    setBgColor(bg);
    setAccentColor(accent);
  }, []);

  const value = useMemo(
    () => ({ fontSize, fontFamily, bgColor, accentColor, setFontSize, setFontFamily, setColors }),
    [fontSize, fontFamily, bgColor, accentColor, setColors]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => useContext(AppSettingsContext);
