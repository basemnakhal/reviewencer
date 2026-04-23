import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-plex-arabic)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Legacy namespace `royal` — now the primary BLUE scale
        royal: {
          50:  '#EAF3FF',
          100: '#CCE2FF',
          200: '#99C6FF',
          300: '#66A9FF', // used for hover borders
          400: '#408EFF',
          500: '#5FA2FF', // hover tint
          600: '#2B8BFF', // PRIMARY brand blue
          700: '#1B6FE0',
          800: '#1454BB',
          900: '#0D1117', // near-black — text / ink
        },
        // Legacy namespace `gold` — now the accent PURPLE scale
        gold: {
          50:  '#F3EAFF',
          100: '#DFC9FF',
          200: '#C299FF',
          300: '#A466FF',
          400: '#9D5FFF', // accent hover
          500: '#7B2CFF', // PRIMARY accent purple
          600: '#6418E0',
          700: '#4F10BB',
          800: '#3B0A92',
          900: '#28066B',
        },
        // Legacy `cream` — now a cool-neutral light scale
        cream: {
          50:  '#FAFAFB',
          100: '#F1F1F3',
          200: '#E2E2E6',
        },
        // Semantic aliases
        brand:  { DEFAULT: '#2B8BFF', hover: '#5FA2FF', ink: '#0D1117' },
        accent: { DEFAULT: '#7B2CFF', hover: '#9D5FFF' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2B8BFF 0%, #7B2CFF 100%)',
        'gold-gradient':  'linear-gradient(135deg, #7B2CFF 0%, #9D5FFF 100%)',
        'royal-gradient': 'linear-gradient(135deg, #2B8BFF 0%, #5FA2FF 100%)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'typing':     'typing 1.2s infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(.95)', opacity: '.8' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)',  opacity: '.4' },
          '30%':           { transform: 'translateY(-4px)', opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
