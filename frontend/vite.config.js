// vite configuration - read automatically at build and dev time
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // react plugin handles jsx transform and hot module replacement
  // tailwindcss plugin processes utility classes at build time
  plugins: [react(), tailwindcss()],

  build: {
    rollupOptions: {
      output: {
        // split large third-party libraries into separate cached chunks
        // browsers can cache vendor code independently from application code
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          'vendor-chartjs':  ['chart.js', 'react-chartjs-2'],
        }
      }
    }
  }
})
