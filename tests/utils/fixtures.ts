/**
 * Test Fixtures Module
 * Provides test data generation and database setup utilities
 * @module test-fixtures
 */

import { randomUUID } from "crypto";
import * as schema from "@/db/schema";
import { content, usersInAuth } from "@/db/schema";
import type { InferInsertModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Type Definitions for Database Operations
 */

/**
 * User insert model type
 * @typedef {InferInsertModel<typeof usersInAuth>} UserInsert
 */
type UserInsert = InferInsertModel<typeof usersInAuth>;

/**
 * Content insert model type
 * @typedef {InferInsertModel<typeof content>} ContentInsert
 */
type ContentInsert = InferInsertModel<typeof content>;

/**
 * Database type with schema
 * @typedef {PostgresJsDatabase<typeof schema>} Database
 */
type Database = PostgresJsDatabase<typeof schema>;

/**
 * Database or transaction type
 * @typedef {Database | Parameters<Parameters<Database["transaction"]>[0]>[0]} DbOrTx
 */
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Creates a test user in the database
 * Handles user creation with proper schema validation and error handling
 * @async
 * @function
 * @param {DbOrTx} db - Database or transaction instance
 * @returns {Promise<UserInsert & { id: string }>} Created user record
 * @throws {Error} If user creation fails or schema validation fails
 * @example
 * const user = await createTestUser(db);
 * console.log(user.id, user.email);
 */
export async function createTestUser(db: DbOrTx) {
  const debug = {
    log: (...args: unknown[]) => console.log("[Test Fixtures]", ...args),
    error: (...args: unknown[]) =>
      console.error("[Test Fixtures Error]", ...args),
  };

  const userInsert: UserInsert = {
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    username: `testuser-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileImageUrl: null,
  };

  try {
    debug.log("Creating user with data:", userInsert);

    // Schema validation
    const schemaCheck = await db.execute(sql`SELECT current_schema()`);
    debug.log("Current schema:", schemaCheck);

    // Table existence check
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
      );
    `);
    debug.log("Users table exists:", tableCheck);

    // User creation with verification
    const [result] = await db
      .insert(usersInAuth)
      .values(userInsert)
      .returning()
      .then((res) => {
        debug.log("User creation successful:", res);
        return res;
      })
      .catch((err) => {
        debug.error("User creation failed:", err);
        throw err;
      });

    // Post-creation verification
    const verifyUser = await db.execute(sql`
      SELECT * FROM auth.users WHERE id = ${result.id}
    `);
    debug.log("User verification:", verifyUser);

    return result;
  } catch (error) {
    debug.error("Error creating test user:", error);
    throw error;
  }
}

/**
 * Creates test content associated with a user
 * Handles content creation with transaction safety and deadlock retry
 * @async
 * @function
 * @param {DbOrTx} db - Database or transaction instance
 * @param {string} userId - ID of the associated user
 * @returns {Promise<ContentInsert & { id: string }>} Created content record
 * @throws {Error} If content creation fails or user doesn't exist
 * @example
 * const content = await createTestContent(db, userId);
 * console.log(content.id, content.title);
 */
export async function createTestContent(db: DbOrTx, userId: string) {
  const debug = {
    log: (...args: unknown[]) => console.log("[Test Fixtures]", ...args),
    error: (...args: unknown[]) =>
      console.error("[Test Fixtures Error]", ...args),
  };

  const contentInsert: ContentInsert = {
    id: randomUUID(),
    title: `Test Content ${Date.now()}`,
    body: "Test content body",
    userId,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    debug.log("Creating content with data:", contentInsert);

    // Transaction-safe content creation
    const result = await db.transaction(async (tx) => {
      // Set schema context
      await tx.execute(sql`SET search_path TO auth, public`);

      // Verify user existence
      const [userExists] = await tx.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM auth.users WHERE id = ${userId}
        );
      `);

      debug.log("User exists check (in transaction):", userExists);

      if (!userExists.exists) {
        throw new Error(`User ${userId} does not exist`);
      }

      // Create content within transaction
      const [newContent] = await tx
        .insert(content)
        .values(contentInsert)
        .returning();

      debug.log("Content creation successful:", newContent);
      return newContent;
    });

    return result;
  } catch (error: unknown) {
    debug.error("Error creating test content:", error);
    // Deadlock retry logic
    if ((error as { code?: string })?.code === "40P01") {
      debug.log("Deadlock detected, retrying content creation...");
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
      return createTestContent(db, userId);
    }
    throw error;
  }
}

/**
 * Creates a test document with default embedding
 * Provides consistent test document structure for vector operations
 * @function
 * @returns {{ content: string, metadata: Object, embedding: number[] }} Test document
 * @example
 * const doc = createTestDocument();
 * console.log(doc.embedding.length); // 1536
 */
export function createTestDocument() {
  return {
    content: "Test document content",
    metadata: {},
    embedding: new Array(1536).fill(0),
  };
}

/**
 * Type Definitions for Test Data
 */

/**
 * Test Document Structure
 * @typedef {Object} TestDocument
 * @property {string} content - Document content
 * @property {Object} metadata - Document metadata
 * @property {number[]} embedding - Vector embedding (1536 dimensions)
 */
type TestDocument = {
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
};
