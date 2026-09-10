const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'garden-browser.spec.js',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: { viewport: { width: 1360, height: 1000 }, launchOptions: { args: ['--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure' },
  reporter: 'list'
});
