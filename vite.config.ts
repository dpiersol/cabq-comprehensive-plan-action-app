import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Vite 8 can serve `dist/client/client.mjs` with `__BUNDLED_DEV__` / `__SERVER_FORWARD_CONSOLE__`
 * still present. That throws in the browser, breaks HMR bootstrap, and leaves a blank page.
 */
function viteClientDevPlaceholderFix(): Plugin {
  const clientTail = "vite/dist/client/client.mjs";
  return {
    name: "vite-client-dev-placeholder-fix",
    enforce: "post",
    transform(code, id) {
      const normalized = id.replace(/\\/g, "/");
      if (!normalized.includes(clientTail)) return;
      if (!code.includes("__BUNDLED_DEV__") && !code.includes("__SERVER_FORWARD_CONSOLE__")) return;
      return code
        .replaceAll("__BUNDLED_DEV__", "false")
        .replaceAll("__SERVER_FORWARD_CONSOLE__", "false");
    },
  };
}

export default defineConfig({
  plugins: [react(), viteClientDevPlaceholderFix()],
  server: {
    /** Listen on all interfaces so both http://127.0.0.1:* and http://localhost:* work on Windows. */
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
