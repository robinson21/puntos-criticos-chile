import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Cloudflare sirve en la raíz; GitHub Pages (respaldo) compila con VITE_BASE=/puntos-criticos-chile/
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          map: ['leaflet', 'react-leaflet']
        }
      }
    }
  }
})
