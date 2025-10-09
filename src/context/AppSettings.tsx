import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  fontFamily: 'Arial',
  bgColor: '#fff9c4',
  accentColor: '#fde695',
  setFontSize: () => {},
  setFontFamily: () => {},
  setColors: () => {},
};

const AppSettingsContext = createContext<SettingsContextProps>(defaultSettings);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [bgColor, setBgColor] = useState('#fff9c4');
  const [accentColor, setAccentColor] = useState('#fde695');

  const setColors = (bg: string, accent: string) => {
    setBgColor(bg);
    setAccentColor(accent);
  };

  return (
    <AppSettingsContext.Provider
      value={{ fontSize, fontFamily, bgColor, accentColor, setFontSize, setFontFamily, setColors }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
