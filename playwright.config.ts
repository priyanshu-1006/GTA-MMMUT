import { defineConfig } from "@playwright/test";

const testPort = 5174;
const origin = `http://127.0.0.1:${testPort}`;
const useProductionBuild = process.env.CAMPUS_TEST_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: origin,
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1200, height: 760 },
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: `${useProductionBuild ? "pnpm --filter @gta-mmmut/web exec vite preview" : "pnpm dev"} --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: origin,
    timeout: 90_000,
  },
});
