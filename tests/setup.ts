/**
 * Global Test Setup Module
 * Configures the global test environment and cleanup procedures
 * @module test-setup
 * @requires @testing-library/react
 * @requires @testing-library/jest-dom
 */

import { expect, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanupTestDatabase } from './helpers/database';

/**
 * Testing Library DOM Matchers Extension
 * Extends Vitest's expect with DOM-specific matchers
 * @example
 * // New matchers available:
 * expect(element).toBeInTheDocument();
 * expect(element).toHaveClass('active');
 * expect(input).toHaveValue('test');
 */
expect.extend(matchers);

/**
 * Global Test Cleanup Hook
 * Automatically runs after each test case
 * Cleans up:
 * - React testing environment
 * - DOM modifications
 * - Event listeners
 * @function
 * @example
 * // Runs automatically, but can be called manually:
 * afterEach(() => {
 *   cleanup();
 * });
 */
afterEach(() => {
  cleanup();
});

/**
 * Global Database Cleanup Hook
 * Runs after all tests are complete
 * Ensures:
 * - Database connections are closed
 * - Test data is cleaned up
 * - Resources are properly released
 * @function
 * @async
 * @example
 * // Runs automatically after all tests
 * afterAll(async () => {
 *   await cleanupTestDatabase();
 * });
 */
afterAll(async () => {
  await cleanupTestDatabase();
});

/**
 * Type Definitions
 */

/**
 * Vitest Matchers Interface
 * Extends the global matchers with Testing Library's DOM matchers
 * @typedef {Object} CustomMatchers
 */
declare global {
  namespace Vi {
    interface JestAssertion<T = any>
      extends jest.Matchers<void, T>,
        matchers.TestingLibraryMatchers<T, void> {}
  }
}

/**
 * @typedef {Object} SetupConfig
 * @property {boolean} autoCleanup - Whether to run cleanup automatically
 * @property {boolean} extendedMatchers - Whether to extend Vitest matchers
 */
type SetupConfig = {
  autoCleanup: boolean;
  extendedMatchers: boolean;
};

/**
 * Default configuration for test setup
 * @constant
 * @type {SetupConfig}
 */
const DEFAULT_CONFIG: SetupConfig = {
  autoCleanup: true,
  extendedMatchers: true,
} as const;

// Export for external configuration if needed
export { DEFAULT_CONFIG }; 