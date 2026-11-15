import React from 'react';
import { CssBaseline } from '@mui/joy';
import { CssVarsProvider, extendTheme } from '@mui/joy/styles';

const theme = extendTheme({
  fontFamily: {
    body: 'Inter, ui-sans-serif, system-ui, sans-serif',
    display: 'Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        background: { body: '#eef2f7', surface: '#ffffff', level1: '#f8fafc' },
        text: { primary: '#0f172a', secondary: '#475569', tertiary: '#64748b' },
        divider: '#cbd5e1',
      },
    },
    dark: {
      palette: {
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#818cf8', 700: '#a5b4fc',
          800: '#c7d2fe', 900: '#e0e7ff',
        },
        background: { body: '#0b1220', surface: '#172234', level1: '#202e43' },
        text: { primary: '#f1f5f9', secondary: '#cbd5e1', tertiary: '#94a3b8' },
        divider: '#475569',
      },
    },
  },
  radius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
});

// JoyShell applies the shared Cartographer palette and Joy component defaults.
export function JoyShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <CssVarsProvider theme={theme} defaultMode="light" modeStorageKey="cartographer_joy_mode"><CssBaseline />{children}</CssVarsProvider>;
}
