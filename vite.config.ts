import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { libcompassApi } from "./scripts/libcompass-api.ts";

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [libcompassApi(), react(), tailwindcss(), tsconfigPaths()],
});
