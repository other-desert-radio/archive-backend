import { defineConfig } from "@playwright/test";

// Bun runs the direct database/auth tests separately, before these API/browser specs.
export default defineConfig({ testMatch: "**/*.spec.ts" });
