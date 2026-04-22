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
        // Trust-blue primary — the carry-over from reviewencer.ae, refined
        royal: {
          50:  '#EEF3FB',
          100: '#D8E3F5',
          200: '#B3C7EB',
          300: '#8CAADF',
          400: '#5281D0',
          500: '#2563EB', // cobalt — active / hover
          600: '#0A47A5', // PRIMARY — royal blue
          700: '#083A87',
          800: '#072E6B',
          900: '#0B1F47', // navy — dark surfaces
        },
        // Gold accent — the other half of the .ae palette
        gold: {
          50:  '#FAF5E6',
          100: '#F5EED0',
          200: '#EDDFA3',
          300: '#E5CE76',
          400: '#E5B44A', // honey
          500: '#D4A72C', // PRIMARY gold
          600: '#B8891F',
          700: '#8F6A17',
          800: '#6A4F10',
          900: '#463509',
        },
        cream: {
          50:  '#FDFBF2',
          100: '#FAF5E6',
          200: '#F5EED0',
        },
        // Semantic aliases so components can say bg-brand, text-accent, etc.
        brand:  { DEFAULT: '#0A47A5', hover: '#2563EB', ink: '#0B1F47' },
        accent: { DEFAULT: '#D4A72C', hover: '#E5B44A' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #0A47A5 0%, #2563EB 55%, #D4A72C 100%)',
        'gold-gradient':  'linear-gradient(135deg, #D4A72C 0%, #E5B44A 100%)',
        'royal-gradient': 'linear-gradient(135deg, #0A47A5 0%, #2563EB 100%)',
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
