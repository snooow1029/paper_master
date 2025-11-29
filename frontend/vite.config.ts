import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允許外部訪問
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // 後端運行在 5001 端口
        changeOrigin: true,
      },
    },
  },
})
