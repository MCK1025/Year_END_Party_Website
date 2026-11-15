import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: ".",
  timeout: 300_000,
  use: { ...base.use, trace: "off" },
});
