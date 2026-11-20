import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * In production the app never needs inline scripts, so the CSP stays tight.
 * Vite's dev server injects a small inline preamble for HMR, so we relax only
 * that directive while running `electron-vite dev`.
 */
function cspPlugin() {
  const replace = (html: string, scriptSrc: string) =>
    html.replaceAll("__CSP_SCRIPT_SRC__", scriptSrc);

  return [
    {
      name: "csp-dev",
      apply: "serve" as const,
      transformIndexHtml: (html: string) => replace(html, "'self' 'unsafe-inline'"),
    },
    {
      name: "csp-build",
      apply: "build" as const,
      transformIndexHtml: (html: string) => replace(html, "'self'"),
    },
  ];
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
      },
    },
    plugins: [react(), tailwindcss(), ...cspPlugin()],
    build: {
      rollupOptions: {
        input: resolve("src/renderer/index.html"),
      },
    },
  },
});
