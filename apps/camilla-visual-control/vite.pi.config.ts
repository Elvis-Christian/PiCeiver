import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: "pi-app",
  base: "/gui/control/",
  plugins: [react()],
  build: {
    outDir: "../pi-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        control: resolve("pi-app/index.html"),
        automations: resolve("pi-app/automations/index.html"),
      },
    },
  },
});
