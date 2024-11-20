/**
 * Test Configuration
 * @module vitest-config
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Core test configuration
const TEST_CONFIG = {
  timeout: 60000,
  retries: 3,
  threads: {
    singleThread: true,
  },
  isolate: true,
} as const;

// Path aliases
const PATH_ALIASES = {
  '@': resolve(__dirname, './'),
  '@/db': resolve(__dirname, './db'),
  '@/lib': resolve(__dirname, './lib'),
  '@/tests': resolve(__dirname, './tests'),
} as const;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: PATH_ALIASES,
  },
  test: {
    // Core configuration
    environment: 'jsdom',
    globals: true,
    setupFiles: [
      './tests/setup.ts',
      './tests/helpers/setup-test-env.ts'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/setup.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        'lib/**/*.{js,jsx,ts,tsx}',
        'db/**/*.{js,jsx,ts,tsx}'
      ],
    },

    // Test execution configuration
    poolOptions: TEST_CONFIG.threads,
    testTimeout: TEST_CONFIG.timeout,
    hookTimeout: TEST_CONFIG.timeout,
    retry: TEST_CONFIG.retries,
    isolate: TEST_CONFIG.isolate,

    // Reporting configuration
    reporters: ['verbose'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/results.html',
    },

    // Test sequence configuration
    sequence: {
      shuffle: true,
    },
  },
});

/**
 * Type Definitions
 */
type CoverageThresholds = {
  branches: number;
  functions: number;
  lines: number;
  statements: number;
};
