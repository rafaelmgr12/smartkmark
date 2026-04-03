import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'src/**/*.unit.test.{ts,tsx}',
        'electron/**/*.unit.test.ts',
        'electron/**/*.test.ts',
      ],
    },
  })
);
