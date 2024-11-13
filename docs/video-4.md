# Video 4: Database & Vector Store Setup

## 1. Introduction

In this guide, we'll set up our database layer using Drizzle ORM and configure vector storage capabilities with pgvector. We'll also implement a robust migration system and optimize our vector searches with HNSW indexes.

- **Recap of Previous Video**: In our last session, we implemented the API layer using tRPC and established type safety across our application.

- **Objectives for This Video**:
  - Set up Drizzle ORM for type-safe database operations
  - Implement a database migration system
  - Configure pgvector for embedding storage
  - Optimize vector searches with HNSW indexes
  - Create utility functions for database operations

## 2. Environment Setup

First, let's set up our development environment with the necessary dependencies.

### Installation

```bash
# Install core dependencies
pnpm add drizzle-orm @supabase/supabase-js postgres openai
pnpm add -D drizzle-kit @types/pg typescript tsx
```
# Install Supabase CLI (macOS/Linux)
brew install supabase/tap/supabase

# For Windows users:
# Download and install from https://github.com/
supabase/cli/releases
### Environment Variables

Create `.env` in your project root:

```env
# Supabase connection URLs (note the ssl=true parameter)
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?ssl=true
DIRECT_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.db.supabase.com:5432/postgres?ssl=true
OPENAI_API_KEY=your-openai-key
```

## 3. Database Connection Setup

1. **Create Database Client**

Create `db/index.ts`:

```typescript:db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from 'dotenv';

// Load environment variables
config();

// Make sure we're using the pooled connection URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Environment variables:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
  });
  throw new Error('DATABASE_URL is not set');
}

console.log('Connecting to database...'); // Debug log

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { 
  prepare: false,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
});

export const db = drizzle(client, { schema });
```

2. **Configure Drizzle**

Create `drizzle.config.ts`:

```typescript:drizzle.config.ts
import type { Config } from "drizzle-kit";
import { config } from 'dotenv';

config({ path: '.env' });

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

## 4. Schema Definition

Our schema includes users, content, metadata, and vector-enabled documents tables.

1. **Create Vector Type**

First, create `db/vector.ts` to handle pgvector's custom type:

```typescript:db/vector.ts
import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    const dt = 
      !!config && typeof config.dimensions === "number"
        ? `vector(${config.dimensions})`
        : "vector";
    return dt;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value !== 'string') {
      throw new Error('Expected string value from database');
    }
    return JSON.parse(value);
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
});
```

2. **Define Schema**

Create `db/schema.ts`:

```typescript:db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb, bigserial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vector } from "./vector";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  profileImageUrl: text("profile_image_url"),
});

// Content table with status enum
export const content = pgTable("content", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] }).default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Metadata table
export const metadata = pgTable("metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => content.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Documents table with vector support
export const documents = pgTable("documents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  content: text("content"),
  metadata: jsonb("metadata"),
  embedding: vector("embedding", { dimensions: 1536 }),
});
```

## 5. Vector Search Setup

Now let's set up our vector search capabilities with HNSW indexing and utility functions.

1. **Add Vector Index and Functions**

Add these to your `schema.ts`:

```typescript:db/schema.ts
// Vector similarity search index
export const vectorIndexSQL = sql`
  CREATE INDEX IF NOT EXISTS documents_embedding_idx 
  ON documents 
  USING hnsw (embedding vector_cosine_ops)
  WITH (
    m = 16,
    ef_construction = 64
  );
`;

// Match documents function
export const matchDocumentsSQL = sql`
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT NULL,
  filter jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  embedding jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    (embedding::text)::jsonb as embedding,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;
```

2. **Create Vector Search Queries**

Create `db/queries.ts` for vector search operations:

```typescript:db/queries.ts
import { db } from "./index";
import { sql } from "drizzle-orm";
import { documents } from "./schema";
import { and } from "drizzle-orm";

// Define similarity operators
export const SimilarityOperator = {
  Cosine: '<=>',      // Cosine distance (most common)
  L2: '<->',          // Euclidean distance
  InnerProduct: '<#>' // Negative inner product
} as const;

// ... rest of the implementation
```

## 6. Embeddings Generation

Create `lib/embeddings.ts`:

```typescript:lib/embeddings.ts
import OpenAI from 'openai';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text.replace(/\n/g, ' '), // Replace newlines with spaces
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export function prepareForEmbedding(doc: { title: string; content: string }): string {
  return `${doc.title}\n\n${doc.content}`.trim();
}
```

## 7. Database Utilities

Create utility functions for common operations in `db/utils.ts`:

```typescript:db/utils.ts
import { db } from "./index";
import { documents } from "./schema";
import { generateEmbedding, prepareForEmbedding } from "../lib/embeddings";
import { eq } from "drizzle-orm";

export async function createDocument({
  title,
  content,
  metadata = {},
}: {
  title: string;
  content: string;
  metadata?: Record<string, any>;
}) {
  const embedding = await generateEmbedding(prepareForEmbedding({ title, content }));
  
  return await db.insert(documents).values({
    content,
    metadata,
    embedding,
  }).returning();
}

// ... rest of the utility functions
```

## 8. Migration System

1. **Create Migration Script**

Create `db/migrate.ts`:

```typescript:db/migrate.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env' });

const runMigrations = async () => {
  const migrationClient = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");

  await migrate(db, {
    migrationsFolder: "drizzle"
  });

  console.log("Migrations complete!");

  await migrationClient.end();
};

runMigrations().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
```

2. **Add Migration Scripts**

Update your `package.json`:

```json:package.json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx db/migrate.ts"
  }
}
```

## 9. Security & Row Level Security

Add RLS policies to your schema:

```typescript:db/schema.ts
export const rls = {
  content: sql`
    ALTER TABLE content ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage own content" ON content
      USING (auth.uid() = user_id);
  `,
  metadata: sql`
    ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage own metadata" ON metadata
      USING (content_id IN (
        SELECT id FROM content WHERE user_id = auth.uid()
      ));
  `,
  users: sql`
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can read own data" ON users
      FOR SELECT USING (auth.uid() = id);
  `
};
```

## 10. Next Steps

In the next video, we'll:
- Implement comprehensive testing for our database layer
- Add error handling and validation
- Create higher-level abstractions for common operations
- Optimize query performance
- Add monitoring and logging

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)
- [Supabase Vector Store Guide](https://supabase.com/docs/guides/database/extensions/pgvector)

## 11. Testing the Setup

Create `scripts/test-vector.ts`:

```typescript:scripts/test-vector.ts
import { db } from '../db';
import { createDocument } from '../db/utils';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import path from 'path';

// Load environment variables from the root .env file
config({ path: path.resolve(process.cwd(), '.env') });

console.log('Environment check:');
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);

async function testVectorOperations() {
  try {
    console.log('Testing database connection...');
    
    // Test basic database connection first
    const testQuery = await db.execute(sql`SELECT 1`);
    console.log('Database connection successful');

    // Test document creation with embedding
    const doc = await createDocument({
      title: "Test Document",
      content: "This is a test document to verify vector operations.",
      metadata: { type: "test" }
    });
    console.log("Created document:", doc);

    // Verify it was stored
    const documents = await db.query.documents.findMany();
    console.log("All documents:", documents);

    console.log("Vector operations test completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    }
  } finally {
    process.exit(0);
  }
}

testVectorOperations();
```

Add the test script to your `package.json`:

```json:package.json
{
  "scripts": {
    // ... other scripts
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx db/migrate.ts",
    "test:vector": "tsx scripts/test-vector.ts"
  }
}
```

### Running the Tests

To test your setup:

1. First, ensure your environment variables are set correctly in `.env`
2. Run the vector operations test:
```bash
pnpm test:vector
```

You should see output indicating:
- Environment variables are loaded
- Database connection is successful
- Document creation with embedding works
- Document retrieval is working

### Troubleshooting Common Issues

1. **SSL Certificate Errors**: If you get SSL certificate errors, ensure your database connection includes `ssl: { rejectUnauthorized: false }` in the postgres client options.

2. **Environment Variables**: Make sure your `.env` file is in the project root and contains all required variables.

3. **OpenAI API Key**: Verify your OpenAI API key is valid and has permissions for embeddings.

4. **Database Connection**: Ensure your Supabase connection URLs include the `ssl=true` parameter.
