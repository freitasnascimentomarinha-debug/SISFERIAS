import colors from 'tailwindcss/colors';

// Acessibilidade (e-MAG / WCAG 2.1 AA): os tons usados em textos e botões
// foram escurecidos para atingir contraste mínimo de 4,5:1 (texto branco sobre
// botão laranja, rótulos cinza, mensagens verdes/amarelas/vermelhas). Cada
// tom aponta para o tom duas posições mais escuro da paleta padrão.
const shift = (palette, map) => ({ ...palette, ...Object.fromEntries(Object.entries(map).map(([k, v]) => [k, palette[v]])) });

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        orange: shift(colors.orange, { 500: 700, 600: 800, 700: 900, 800: 900 }),
        slate: shift(colors.slate, { 400: 500, 500: 600 }),
        green: shift(colors.green, { 500: 700, 600: 800, 700: 900 }),
        emerald: shift(colors.emerald, { 500: 700, 600: 800, 700: 900 }),
        amber: shift(colors.amber, { 500: 700, 600: 800, 700: 900 }),
        red: shift(colors.red, { 500: 700, 600: 700, 700: 800 }),
        sky: shift(colors.sky, { 500: 700, 600: 700, 700: 800 }),
        blue: shift(colors.blue, { 500: 700, 600: 700, 700: 800 }),
      },
    },
  },
  plugins: [],
};
