/**
 * Document Operations Integration Tests
 * Tests vector embeddings, document creation, and similarity search functionality
 * @module documents.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDatabase } from "../helpers/database";
import { createDocument } from "@/db/utils";
import { findSimilarDocuments } from "@/db/queries";
import { createTestDocument } from "../utils/fixtures";
import { documents, usersInAuth } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Debug utility for document test logging
 * Provides consistent logging format for test operations
 * @constant
 */
const debug = {
  enabled: true,
  log: (...args: unknown[]) => console.log("[Documents Test]", ...args),
  error: (...args: unknown[]) => console.error("[Documents Test Error]", ...args),
};

/**
 * Mock configuration for OpenAI embeddings
 * Provides consistent vector embeddings for testing
 * @constant
 */
vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  prepareForEmbedding: vi.fn((text) => text),
}));

/**
 * Document Operations Test Suite
 * Tests document management and vector similarity search
 * @group Integration
 * @group Documents
 * @group Vector
 */
describe("Document Operations", () => {
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
    testId = `doc-test-${Date.now()}`;
    const testDb = await createTestDatabase(testId);
    db = testDb.db;
    cleanupFn = testDb.cleanup;
  }, 60000); // 60 second timeout for vector extension setup

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
   * Test: Document Creation with Vector Embedding
   * Verifies document creation with metadata and embedding generation
   * @test
   * @async
   * @example
   * // Expected document structure:
   * {
   *   id: number,
   *   content: string,
   *   metadata: { test: boolean },
   *   embedding: number[] // 1536-dimensional vector
   * }
   */
  it("should create and retrieve a document with embedding", async () => {
    debug.log("Starting document creation test...");
    try {
      // Create test document with mock embedding
      const testDoc = createTestDocument();
      debug.log("Created test document:", testDoc);

      // Insert document with metadata and embedding
      const result = await db
        .insert(documents)
        .values({
          content: testDoc.content,
          metadata: { test: true },
          embedding: testDoc.embedding,
        })
        .returning();

      debug.log("Document creation result:", result);

      // Verify document structure and embedding
      expect(result[0]).toMatchObject({
        content: testDoc.content,
        metadata: { test: true },
      });
      expect(result[0].embedding).toHaveLength(1536);
      debug.log("Document creation test passed");
    } catch (error) {
      debug.error("Document creation test failed:", error);
      throw error;
    }
  });

  /**
   * Test: Vector Similarity Search
   * Verifies pgvector similarity search functionality
   * Tests the ability to find similar documents using vector embeddings
   * @test
   * @async
   * @example
   * // Vector similarity query structure:
   * SELECT id, content 
   * FROM test.documents 
   * ORDER BY embedding <-> [vector] LIMIT 1
   */
  it("should find similar documents using vector search", async () => {
    debug.log("Starting vector similarity test...");
    
    try {
      // Insert first test document
      debug.log("Attempting to insert first document...");
      const doc1 = await db.insert(documents)
        .values(createTestDocument())
        .returning();
      debug.log("First document inserted:", doc1[0].id);

      // Insert second test document
      debug.log("Attempting to insert second document...");
      const doc2 = await db.insert(documents)
        .values(createTestDocument())
        .returning();
      debug.log("Second document inserted:", doc2[0].id);

      // Verify document creation and embeddings
      const firstDoc = doc1[0];
      const firstEmbedding = firstDoc?.embedding;

      if (!firstDoc || !firstEmbedding) {
        throw new Error("First document or its embedding is null");
      }

      debug.log("Starting vector similarity query...");
      debug.log("Embedding length:", firstEmbedding.length);
      
      // Execute vector similarity search with null-checked embedding
      const result = await db.execute(sql`
        SELECT id, content 
        FROM test.documents 
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${`[${firstEmbedding.join(',')}]`}::vector(1536)
        LIMIT 1
      `);

      debug.log("Query completed, result:", result);
      expect(result[0]).toBeDefined();
      
    } catch (error: unknown) {
      debug.error("Test failed with error:", error);
      debug.error("Error stack:", (error as Error).stack);
      throw error;
    }
  }, 30000);
});

/**
 * Type Definitions
 */

/**
 * Document Test Result
 * @typedef {Object} DocumentTestResult
 * @property {number} id - Document ID
 * @property {string} content - Document content
 * @property {Object} metadata - Document metadata
 * @property {number[]} embedding - Vector embedding
 */
type DocumentTestResult = {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
};
