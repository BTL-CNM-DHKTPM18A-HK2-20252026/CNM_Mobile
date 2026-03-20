/**
 * Theme configuration for the project (Colors, Typography, Spacing).
 * Centralized file for maintaining consistency across screens.
 */

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // Brand Colors (Zalo style)
  primary: '#0068ff', // Main Zalo blue
  secondary: '#2b68e8', // Light blue
  background: '#ffffff',
  surface: '#f1f2f6', // Light grey for backgrounds/buttons
  
  // Text Colors
  text: '#000000',
  textSecondary: '#666666',
  textPlaceholder: '#999999',
  textWhite: '#ffffff',
  
  // UI Colors
  border: '#e0e0e0',
  error: '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
  inactive: '#8e8e93',
  
  // Shorthands for dark mode if needed
  dark: {
    background: '#1c1c1e',
    text: '#ffffff',
    surface: '#2c2c2e',
  }
};

export const SIZES = {
  // Font sizes
  h1: 32,
  h2: 24,
  h3: 20,
  h4: 14,
  h5: 12,
  h6: 11,
  h7: 10,
  body1: 18,
  body2: 16,
  body3: 14,
  body4: 12,
  caption: 12,
  micro: 10,
  
  // Spacing
  padding: 20,
  margin: 20,
  radius: 12,
  radiusFull: 99,
  
  // Screen dimensions
  width,
  height,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: SIZES.h1,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: SIZES.h2,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: SIZES.body2,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: SIZES.body2,
    fontWeight: '600' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  }
};

export default { COLORS, SIZES, TYPOGRAPHY };
