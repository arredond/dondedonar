import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// The dev server runs over HTTPS (only affects `vite` dev/preview, not the
// build): browsers only allow geolocation in a secure context, which the LAN
// address phones use to open the dev server (http://192.168.x.x) isn't.
// `bin/dondedonar start` issues a certificate from mkcert's local CA into
// .dondedonar/ when mkcert is installed, which this machine trusts (and any
// phone that has mkcert's root CA installed). Without it, basicSsl serves a
// self-signed certificate and each device has to accept the warning once.
const CERT = new URL('../.dondedonar/cert.pem', import.meta.url)
const KEY = new URL('../.dondedonar/key.pem', import.meta.url)
const hasMkcert = fs.existsSync(CERT) && fs.existsSync(KEY)

export default defineConfig({
  plugins: [react(), ...(hasMkcert ? [] : [basicSsl()])],
  server: hasMkcert ? { https: { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) } } : {},
  base: process.env.VITE_BASE_URL ?? '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
