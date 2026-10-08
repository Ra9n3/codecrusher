import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Run with: npx vitest run   (package.json scripts are managed outside this change set)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
