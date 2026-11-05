import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // basicSsl serves the dev server over HTTPS with a self-signed certificate
  // (only affects `vite` dev/preview, not the build). Browsers only allow
  // geolocation in a secure context, which the LAN address phones use to
  // open the dev server (http://192.168.x.x) isn't; each device has to accept
  // the certificate warning once.
  plugins: [react(), basicSsl()],
  base: process.env.VITE_BASE_URL ?? '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
