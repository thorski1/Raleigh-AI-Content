/**
 * Test Environment Setup Module
 * Configures and validates the test environment before test execution
 * @module setup-test-env
 */

import path from "path";
import { config } from "dotenv";

/**
 * Environment variable configuration
 * Loads test-specific environment variables from .env.test file
 * @constant
 * @example
 * // .env.test file content example:
 * // DATABASE_URL=postgres://user:pass@localhost:5432/test_db
 * // DIRECT_URL=postgres://user:pass@localhost:5432/test_db
 */
config({
  path: path.resolve(__dirname, "../../.env.test"),
});

/**
 * Required environment variables for test execution
 * These variables must be present in the .env.test file
 * @constant
 * @property {string} DATABASE_URL - Main database connection string
 * @property {string} DIRECT_URL - Direct database connection string (bypassing pooling)
 */
const requiredEnvVars = [
  "DATABASE_URL", // Main connection string for the test database
  "DIRECT_URL", // Direct connection string (used for migrations)
] as const;

/**
 * Validates presence of required environment variables
 * Throws an error if any required variable is missing
 * @throws {Error} If a required environment variable is not set
 * @example
 * // This validation runs automatically when this module is imported
 * import './setup-test-env';
 */
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}
    Please ensure you have a .env.test file with all required variables.
    Required variables: ${requiredEnvVars.join(", ")}`);
  }
}

/**
 * Environment validation
 * Warns if NODE_ENV is not set to 'test'
 * This is crucial for maintaining test isolation and preventing accidental production database access
 * @example
 * // Proper test execution:
 * NODE_ENV=test vitest
 */
if (process.env.NODE_ENV !== "test") {
  console.warn(`
    ⚠️  Warning: Environment is not set to test. Some tests may fail.
    Current NODE_ENV: ${process.env.NODE_ENV}
    Recommended: Set NODE_ENV=test before running tests
    Example: NODE_ENV=test vitest
  `);
}

/**
 * Type definition for supported environment variables
 * Provides TypeScript type safety for environment variable access
 * @typedef {Object} TestEnvVars
 * @property {string} DATABASE_URL - Database connection string
 * @property {string} DIRECT_URL - Direct database connection string
 * @property {'test'} NODE_ENV - Node environment
 */
export type TestEnvVars = {
  DATABASE_URL: string;
  DIRECT_URL: string;
  NODE_ENV: "test";
};

/**
 * Type assertion for process.env
 * Ensures TypeScript recognizes our environment variables
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv extends TestEnvVars {}
  }
}
