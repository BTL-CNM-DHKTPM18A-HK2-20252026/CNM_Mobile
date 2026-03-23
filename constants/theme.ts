import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  primary: '#0068ff',
  secondary: '#2b68e8',
  error: '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
  inactive: '#8e8e93',
  textWhite: '#ffffff',
  
  light: {
    background: '#ffffff',
    surface: '#f1f2f6',
    text: '#000000',
    textSecondary: '#666666',
    textPlaceholder: '#999999',
    border: '#e0e0e0',
    card: '#ffffff',
    header: '#0068ff',
    tabBar: '#ffffff',
    chatBackground: '#f2f2f7',
  },
  
  dark: {
    background: '#000000',
    surface: '#1c1c1e',
    text: '#ffffff',
    textSecondary: '#aeb0b5',
    textPlaceholder: '#545458',
    border: '#38383a',
    card: '#1c1c1e',
    header: '#1c1c1e',
    tabBar: '#1c1c1e',
    chatBackground: '#000000',
  }
};

export const SIZES = {
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
  padding: 20,
  margin: 20,
  radius: 12,
  radiusFull: 99,
  width,
  height,
};

export const TYPOGRAPHY = {
  h1: { fontSize: SIZES.h1, fontWeight: '700' as const },
  h2: { fontSize: SIZES.h2, fontWeight: '700' as const },
  body: { fontSize: SIZES.body2, fontWeight: '400' as const },
  bodyBold: { fontSize: SIZES.body2, fontWeight: '600' as const },
  button: { fontSize: 16, fontWeight: '600' as const },
};

export default { COLORS, SIZES, TYPOGRAPHY };
