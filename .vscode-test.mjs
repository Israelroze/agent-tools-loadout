import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
  {
    label: 'unitTests',
    files: 'out/test/unit/**/*.test.js',
    mocha: { timeout: 10000, ui: 'bdd' }
  },
  {
    label: 'integrationTests',
    files: 'out/test/integration/**/*.test.js',
    mocha: { timeout: 30000, ui: 'bdd' }
  }
]);
