import path from "path";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { createDocument } from "../db/utils";

// Load environment variables from the root .env file
config({ path: path.resolve(process.cwd(), ".env") });

console.log("Environment check:");
console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
console.log("OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);

async function testVectorOperations() {
  try {
    console.log("Testing database connection...");

    // Test basic database connection first
    const testQuery = await db.execute(sql`SELECT 1`);
    console.log("Database connection successful");

    // Test document creation with embedding
    const doc = await createDocument({
      title: "Test Document",
      content: "This is a test document to verify vector operations.",
      metadata: { type: "test" },
    });
    console.log("Created document:", doc);

    // Verify it was stored
    const documents = await db.query.documents.findMany();
    console.log("All documents:", documents);

    console.log("Vector operations test completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
    }
  } finally {
    process.exit(0);
  }
}

testVectorOperations();
