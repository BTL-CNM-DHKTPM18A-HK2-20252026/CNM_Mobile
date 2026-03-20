import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './translations/en.json';
import vi from './translations/vi.json';

const resources = {
  EN: {
    translation: en,
  },
  VI: {
    translation: vi,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'VI', // Default language
  fallbackLng: 'VI',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
