import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** 生成带构建版本与完整资源清单的离线包，支持子目录部署。 */
function offlineShell(): Plugin {
  return {
    name: "offline-shell",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(name => name !== "sw.js").sort();
      const fingerprint = createHash("sha256");
      for (const name of files) {
        const item = bundle[name]!;
        fingerprint.update(name);
        fingerprint.update(item.type === "chunk" ? item.code : item.source);
      }
      const version = fingerprint.digest("hex").slice(0, 16);
      const shell = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", ...files.map(name => `./${name}`)];
      this.emitFile({ type: "asset", fileName: "sw.js", source: `
const CACHE = ${JSON.stringify('attention-highlight-')} + ${JSON.stringify(version)};
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('attention-highlight-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('./index.html', self.registration.scope)))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});` });
    },
  };
}
export default defineConfig({
  base: "./",
  plugins: [react(), offlineShell()],
  server: { port: 5173, host: "127.0.0.1" },
  build: { target: "es2022" },
});
