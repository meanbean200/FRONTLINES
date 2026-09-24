import {defineConfig,configDefaults} from 'vitest/config';

export default defineConfig({
  test: {
    // Real-browser specs run separately through `npm run test:e2e`.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
