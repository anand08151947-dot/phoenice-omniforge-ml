import { createTheme, type ThemeOptions } from '@mui/material/styles'

const brandColors = {
  primary: '#6C63FF',
  secondary: '#FF6584',
  success: '#4CAF50',
  warning: '#FFA726',
  error: '#EF5350',
  bgDark: '#0D1117',
  bgLight: '#F5F7FA',
  surfaceDark: '#161B22',
  surfaceLight: '#FFFFFF',
  borderDark: '#30363D',
  borderLight: '#E0E4EA',
}

const commonOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
}

export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: { main: brandColors.primary },
    secondary: { main: brandColors.secondary },
    success: { main: brandColors.success },
    warning: { main: brandColors.warning },
    error: { main: brandColors.error },
    background: {
      default: brandColors.bgDark,
      paper: brandColors.surfaceDark,
    },
    divider: brandColors.borderDark,
  },
})

export const lightTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'light',
    primary: { main: brandColors.primary },
    secondary: { main: brandColors.secondary },
    success: { main: brandColors.success },
    warning: { main: brandColors.warning },
    error: { main: brandColors.error },
    background: {
      default: brandColors.bgLight,
      paper: brandColors.surfaceLight,
    },
    divider: brandColors.borderLight,
  },
})
