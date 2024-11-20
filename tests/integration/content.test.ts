/**
 * Content Management Integration Tests
 * Tests the content creation, retrieval, and relationship management with users
 * @module content.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../helpers/database";
import { createTestUser, createTestContent } from "../utils/fixtures";
import { content, usersInAuth } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Debug utility for content test logging
 * Provides consistent logging format for test operations
 * @constant
 */
const debug = {
  log: (...args: any[]) => console.log("[Content Test]", ...args),
  error: (...args: any[]) => console.error("[Content Test Error]", ...args),
};

/**
 * Type Definitions for Content Management
 */

/**
 * User model type from schema
 * @typedef {InferSelectModel<typeof usersInAuth>} User
 */
type User = InferSelectModel<typeof usersInAuth>;

/**
 * Content model type from schema
 * @typedef {InferSelectModel<typeof content>} Content
 */
type Content = InferSelectModel<typeof content>;

/**
 * Combined content and user type for joined queries
 * @typedef {Content & { user: User | null }} ContentWithUser
 */
type ContentWithUser = Content & { user: User | null };

/**
 * Content Management Test Suite
 * Tests content CRUD operations and relationships
 * @group Integration
 * @group Content
 */
describe("Content Management", () => {
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
   */
  beforeEach(async () => {
    testId = `content-test-${Date.now()}`;
    const testDb = await createTestDatabase(testId);
    db = testDb.db;
    cleanupFn = testDb.cleanup;
  }, 30000);

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
  }, 30000);

  /**
   * Test: Content Creation and Retrieval with User Relationship
   * Verifies the complete content lifecycle including:
   * - Database schema validation
   * - User creation
   * - Content creation
   * - Relationship integrity
   * - Transaction handling
   *
   * @test
   * @async
   * @example
   * // Expected successful result structure:
   * {
   *   content: {
   *     id: uuid,
   *     user_id: uuid,
   *     title: string,
   *     body: string,
   *     // ... other content fields
   *   },
   *   user: {
   *     id: uuid,
   *     email: string,
   *     // ... other user fields
   *   }
   * }
   */
  it("should create and retrieve content with metadata", async () => {
    try {
      debug.log("Starting content test...");

      // Verify database connection and schema context
      const schemaCheck = await db.execute(
        sql`SELECT current_schema(), current_database()`,
      );
      debug.log("Database context:", schemaCheck);

      // Execute test operations in a transaction for atomicity
      const result = await db.transaction(async (tx) => {
        debug.log("Creating test user...");
        const user = await createTestUser(tx);
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        debug.log("Test user created:", user);

        // Verify user persistence within transaction
        const [userCheck] = await tx.execute(sql`
          SELECT * FROM auth.users WHERE id = ${user.id}
        `);
        debug.log("User verification after creation:", userCheck);

        // Create and verify content
        debug.log("Creating test content...");
        const content = await createTestContent(tx, user.id);
        debug.log("Content created:", content);

        // Verify content-user relationship
        const [contentWithUser] = await tx.execute(sql`
          SELECT c.*, u.* 
          FROM auth.content c
          LEFT JOIN auth.users u ON c.user_id = u.id
          WHERE c.id = ${content.id}
        `);
        debug.log("Content with user join:", contentWithUser);

        return { content: contentWithUser, user: userCheck };
      });

      // Validate test results
      expect(result.content).toBeDefined();
      expect(result.content.user_id).toBe(result.user.id);
      debug.log("Content test completed successfully");
    } catch (error: any) {
      // Comprehensive error logging for debugging
      debug.error("Content test failed:", error);
      debug.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
        schema: error.schema_name,
        table: error.table_name,
        constraint: error.constraint_name,
        detail: error.detail,
      });
      throw error;
    }
  }, 30000);
});
