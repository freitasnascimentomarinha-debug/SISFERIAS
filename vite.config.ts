import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o Vite (porta 5173) repassa /api para o servidor
// Node (porta 3000, `npm run dev:server`). Em produção, o próprio servidor
// Node entrega a interface compilada em dist/.
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 3000}`,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas grandes em arquivos próprios: mudam pouco entre versões
        // e ficam guardadas no navegador.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit)[\\/]/.test(id)) return 'graficos';
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]date-fns[\\/]/.test(id)) return 'datas';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
