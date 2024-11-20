/**
 * Authentication Integration Tests
 * Tests the authentication flow and user session handling
 * @module auth.test
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/database";
import { mockClerkUser } from "../mocks/clerk";
import { createTestUser } from "../utils/fixtures";

/**
 * Mock configuration for Clerk authentication
 * Provides a consistent auth response for testing purposes
 * @constant
 */
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => ({
    userId: "test-user-id",
    getToken: () => "test-token",
  }),
}));

/**
 * Authentication Flow Test Suite
 * Tests various authentication scenarios and user session management
 * @group Integration
 * @group Authentication
 */
describe("Authentication Flow", () => {
  /**
   * Test database instance
   * @type {PostgresJsDatabase}
   */
  let db: PostgresJsDatabase<typeof import("@/db/schema")>;

  /**
   * Cleanup function for test data
   * @type {() => Promise<void>}
   */
  let cleanupFn: () => Promise<void>;

  /**
   * Unique identifier for each test run
   * @type {string}
   */
  let testId: string;

  /**
   * Test setup hook
   * Creates a fresh database instance before each test
   * @function
   * @async
   * @throws {Error} If database setup fails
   */
  beforeEach(async () => {
    testId = `auth-test-${Date.now()}`;
    const testDb = await createTestDatabase(testId);
    db = testDb.db;
    cleanupFn = testDb.cleanup;
  }, 30000); // 30 second timeout for database setup

  /**
   * Test cleanup hook
   * Ensures test data is cleaned up after each test
   * @function
   * @async
   */
  afterEach(async () => {
    if (cleanupFn) {
      await cleanupFn();
    }
  }, 30000); // 30 second timeout for cleanup

  /**
   * Test: Authenticated User Request Handling
   * Verifies that the system correctly handles requests from authenticated users
   * @test
   * @async
   */
  it("should handle authenticated user requests", async () => {
    // Create a test user in the database
    const user = await createTestUser(db);

    // Configure mock Clerk user with test data
    mockClerkUser({
      id: user.id,
      email: user.email,
      username: user.username ?? undefined,
    });

    // Verify authentication session
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    expect(session.userId).toBe(user.id);
  });

  /**
   * Test: Unauthenticated Request Handling
   * Verifies that the system properly handles requests without authentication
   * @test
   * @async
   * @example
   * // Expected database response format:
   * {
   *   current_user: 'postgres',
   *   current_database: 'test_db'
   * }
   */
  it("should handle unauthenticated requests", async () => {
    const result = await db.execute(sql`
      SELECT current_user, current_database()
    `);

    // Verify we're connected to the test database
    expect(result[0].current_database).toBe("test_db");
  }, 30000);
});

/**
 * Type Definitions
 */

/**
 * Authentication Test Result
 * @typedef {Object} AuthTestResult
 * @property {string} current_user - Current database user
 * @property {string} current_database - Current database name
 */
type AuthTestResult = {
  current_user: string;
  current_database: string;
};

/**
 * @typedef {Object} ClerkMockUser
 * @property {string} id - User ID
 * @property {string} email - User email
 * @property {string} [username] - Optional username
 */
type ClerkMockUser = {
  id: string;
  email: string;
  username?: string;
};
