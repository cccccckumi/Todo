import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/desktop', timeout: 60000, workers: 1, fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/desktop-results.json' }]],
  use: { trace: 'retain-on-failure' },
});
