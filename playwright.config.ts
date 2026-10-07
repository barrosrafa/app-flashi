import { defineConfig,devices } from '@playwright/test';
const baseURL=process.env.E2E_BASE_URL??'http://localhost:3000';
export default defineConfig({
 testDir:'./tests/e2e',timeout:45000,fullyParallel:false,workers:1,
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 use:{baseURL,trace:'off',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:process.env.E2E_BASE_URL?undefined:{command:process.env.CI?'pnpm start':'pnpm dev',url:baseURL,reuseExistingServer:!process.env.CI,timeout:120000},
});
