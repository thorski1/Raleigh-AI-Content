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

## 2. Drizzle ORM Setup

Drizzle ORM provides type-safe database operations with excellent TypeScript support and minimal overhead.

### Installation

```bash
# Install database dependencies
pnpm add drizzle-orm @supabase/supabase-js postgres
pnpm add -D drizzle-kit @types/pg typescript tsx

# Install Supabase CLI (macOS/Linux)
brew install supabase/tap/supabase

# For Windows users:
# Download and install from https://github.com/supabase/cli/releases
```

### Prerequisites

1. **Install Docker Desktop**:
   - Download and install Docker Desktop from https://www.docker.com/products/docker-desktop
   - Start Docker Desktop
   - Wait for Docker to be fully running

### Pull Existing Schema from Supabase

There are two ways to get your schema:

#### Option 1: Using Supabase CLI (Requires Docker)
1. **Generate Access Token**:
   - Go to https://supabase.com/dashboard/account/tokens
   - Click "Generate new token"
   - Give it a name (e.g., "CLI Access")
   - Copy the generated token

2. **Login to Supabase CLI**:
```bash
supabase login
# When prompted, paste your access token from step 1
```

3. **Initialize Supabase**:
```bash
supabase init
```

4. **Link Your Project and Pull Schema**:
```bash
# Make sure Docker Desktop is running first!
supabase link --project-ref your-project-ref
supabase db dump --schema public > db/schema_reference.sql
```

#### Option 2: Manual Schema Export (No Docker required)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run and copy the result of:
```sql
SELECT 
  'CREATE TABLE ' || tablename || ' (' ||
  string_agg(
    column_name || ' ' ||  type || 
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    ', '
  ) || ');'
FROM (
  SELECT 
    c.table_name AS tablename,
    c.column_name,
    c.is_nullable,
    c.column_default,
    CASE 
      WHEN c.udt_name = 'vector' THEN 'vector(' || 
        (SELECT typmod FROM pg_type t JOIN pg_attribute a ON a.atttypid = t.oid 
         WHERE t.typname = 'vector' AND a.attrelid = (c.table_name::regclass) 
         AND a.attname = c.column_name) || ')'
      ELSE c.udt_name
    END AS type
  FROM information_schema.columns c
  WHERE table_schema = 'public'
  ORDER BY c.ordinal_position
) t
GROUP BY tablename;
```

4. Save the output to `db/schema_reference.sql`

### Configuration

1. **Create Database Connection**

First, let's set up our database connection. Create `db/index.ts`:

```typescript:db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Disable prefetch as it is not supported for "Transaction" pool mode 
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client);
```

2. **Create Vector Type**

Create `db/vector.ts` to handle the pgvector custom type:

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

3. **Define Schema**

Create `db/schema.ts` using our reference SQL schema:

```typescript:db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb, bigint, varchar, bigserial } from "drizzle-orm/pg-core";
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

// Row Level Security Policies
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

Key features of our schema:

1. **Tables**:
   - `users`: Core user data with profile image support
   - `content`: Main content table with draft/published/archived status
   - `metadata`: Flexible key-value metadata for content
   - `documents`: Vector-enabled document storage for embeddings

2. **Vector Support**:
   - Custom vector type for 1536-dimension embeddings
   - HNSW index for efficient similarity search
   - Match documents function for semantic search

3. **Security**:
   - Row Level Security (RLS) policies for all tables
   - Cascade deletion for related records
   - User-based access control

4. **Data Types**:
   - UUID for most primary keys
   - BigSerial for documents table
   - JSONB for flexible metadata
   - Timestamptz for all timestamps
   - Vector type for embeddings

5. **Relationships**:
   - User -> Content (one-to-many)
   - Content -> Metadata (one-to-many)
   - All foreign keys with cascade delete

4. **Configure Drizzle**

Create `drizzle.config.ts` in your project root:

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

5. **Update Environment Variables**

Your `.env` file should have the Supabase connection URL:

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

6. **Add Migration Scripts**

Update your `package.json`:

```json:package.json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

## 3. Migration System

Drizzle provides several approaches to manage database schema changes. Since we're working with an existing Supabase database, we'll use a combination of database-first and code-first approaches.

### Setup Migration System

1. **Create Migration Script**

Create `db/migrate.ts`:

```typescript:db/migrate.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env' });

const runMigrations = async () => {
  // Disable prefetch as it is not supported for "Transaction" pool mode
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

2. **Update Environment Variables**

Create or update your `.env` file:

```env:.env
# Supabase connection pooler URL (for Drizzle)
DATABASE_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Direct connection URL (for migrations)
DIRECT_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.db.supabase.com:5432/postgres"
```

3. **Add Migration Scripts**

Update your `package.json`:

```json:package.json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx db/migrate.ts",
    "supabase:link": "supabase link --project-ref your-project-ref",
    "supabase:pull": "supabase db pull",
    "supabase:push": "supabase db push"
  }
}
```

### Migration Workflows

1. **Development Workflow**:
```bash
# Make changes to your schema.ts file
pnpm db:generate   # Generate migration files
pnpm db:push      # Push changes directly to dev database
```

2. **Production Workflow**:
```bash
# Generate migrations
pnpm db:generate

# Review generated SQL in ./drizzle folder

# Apply migrations using migration script
pnpm db:migrate
```

3. **Team Collaboration**:
```bash
# Pull latest schema
pnpm supabase:pull

# Generate new migration
pnpm db:generate

# Apply migrations
pnpm db:migrate
```

### Important Notes

1. **Connection Types**:
   - Use `DATABASE_URL` (pooler) for general application connections
   - Use `DIRECT_URL` for migrations and schema changes
   - Always set `prepare: false` when using the connection pooler

2. **Migration Safety**:
   - Always review generated migrations before applying
   - Use `db:push` only in development
   - Back up your database before running migrations in production
   - Test migrations in a staging environment first

3. **Version Control**:
   - Commit migration files to your repository
   - Never modify existing migrations
   - Create new migrations for changes
   - Keep `schema.ts` and migrations in sync

## 4. pgvector Configuration

pgvector is a powerful Postgres extension that enables efficient storage and similarity search for embeddings. Supabase has pgvector pre-installed and configured on all projects.

### Understanding Vector Storage

Before we configure pgvector, it's important to understand a few key concepts:
- Embeddings are numerical representations of data (text, images, etc.)
- Each embedding is a vector of floating-point numbers
- The dimension (1536 in our case) must match your embedding model's output
- OpenAI's text-embedding-ada-002 model outputs 1536 dimensions

### Enable pgvector Extension

First, enable the vector extension in Supabase. You can do this through the Dashboard (Database > Extensions) or via SQL:

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the documents table with vector support
CREATE TABLE documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  embedding vector(1536)
);
```

### Configure Vector Column in Drizzle

In your Drizzle schema, define the vector column using a custom type:

```typescript:db/vector.ts
import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{ data: number[]; notNull: boolean; dimensions: number }>({
  dataType(options) {
    return `vector(${options.dimensions})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});
```

Then use it in your schema:

```typescript:db/schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { vector } from "./vector";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
});
```

### Create Embedding Utility

Create `lib/embeddings.ts` for generating embeddings:

```typescript:lib/embeddings.ts
import OpenAI from 'openai';

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

// Utility to combine multiple text fields for embedding
export function prepareForEmbedding(doc: { title: string; content: string }): string {
  return `${doc.title}\n\n${doc.content}`.trim();
}
```

### Vector Search Functions

Create `db/queries.ts` to implement vector similarity search functions using Drizzle ORM and pgvector:

```typescript:db/queries.ts
import { db } from "./index";
import { sql } from "drizzle-orm";
import { documents } from "./schema";
import { and } from "drizzle-orm";

// Define similarity operators
export const SimilarityOperator = {
  Cosine: '<=>',      // Cosine distance (most common)
  L2: '<->',          // Euclidean distance
  InnerProduct: '<#>' // Negative inner product (dot product)
} as const;

type SimilarityOperatorType = typeof SimilarityOperator[keyof typeof SimilarityOperator];

interface VectorSearchOptions {
  operator?: SimilarityOperatorType;
  limit?: number;
  threshold?: number;
  filterMetadata?: Record<string, any>;
}

/**
 * Find similar documents using vector similarity search
 */
export async function findSimilarDocuments(
  embedding: number[],
  options: VectorSearchOptions = {}
) {
  const {
    operator = SimilarityOperator.Cosine,
    limit = 5,
    threshold = 0.8,
    filterMetadata,
  } = options;

  // Convert embedding to Postgres vector format
  const vectorQuery = sql`${sql.raw(`'[${embedding.join(",")}]'::vector`)}`;
  
  // Build where conditions
  const conditions = [
    sql`embedding ${sql.raw(operator)} ${vectorQuery} < ${1 - threshold}`,
  ];

  // Add metadata filter if provided
  if (filterMetadata) {
    conditions.push(sql`metadata @> ${JSON.stringify(filterMetadata)}::jsonb`);
  }

  return await db.query.documents.findMany({
    columns: {
      id: true,
      content: true,
      metadata: true,
    },
    extras: {
      similarity: sql`1 - (embedding ${sql.raw(operator)} ${vectorQuery})`.as('similarity'),
    },
    where: and(...conditions),
    orderBy: sql`embedding ${sql.raw(operator)} ${vectorQuery}`,
    limit,
  });
}

/**
 * Use the match_documents PL/pgSQL function
 */
export async function matchDocuments(
  embedding: number[],
  {
    limit = 5,
    filterMetadata = {},
  }: {
    limit?: number;
    filterMetadata?: Record<string, any>;
  } = {}
) {
  return await db.execute<{
    id: number;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>(sql`
    SELECT * FROM match_documents(
      ${sql.raw(`'[${embedding.join(",")}]'::vector`)},
      ${limit},
      ${filterMetadata ? sql.raw(`'${JSON.stringify(filterMetadata)}'::jsonb`) : sql.raw(`'{}'::jsonb`)}
    )
  `);
}
```

Make sure your `db/index.ts` is properly configured with the schema:

```typescript:db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Disable prefetch as it is not supported for "Transaction" pool mode 
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
```

The vector search implementation provides:

1. **Multiple Search Methods**:
   - Basic similarity search with customizable operators (Cosine, L2, Inner Product)
   - Match documents using the optimized PL/pgSQL function
   - Support for metadata filtering

2. **Type Safety**:
   - Full TypeScript support with proper type definitions
   - SQL injection prevention through parameterized queries
   - Strict parameter typing

3. **Flexible Options**:
   - Configurable similarity operators
   - Adjustable similarity thresholds
   - Metadata filtering using JSONB operators
   - Customizable result limits

4. **Performance Features**:
   - Uses HNSW index automatically when available
   - Efficient SQL queries
   - Support for batch operations
   - Metadata filtering using JSONB operators

Usage examples:

```typescript
// Basic similarity search
const similar = await findSimilarDocuments(embedding, {
  limit: 5,
  threshold: 0.8
});

// Search with metadata filter
const filtered = await findSimilarDocuments(embedding, {
  filterMetadata: { category: "science" }
});

// Using match_documents function
const matches = await matchDocuments(embedding, {
  limit: 5,
  filterMetadata: { status: "published" }
});
```

### Performance Considerations

1. **Indexing**:
   - HNSW indexes are recommended for production (covered in next section)
   - For development/testing, you can start without indexes
   - Monitor query performance with `EXPLAIN ANALYZE`

2. **Memory Usage**:
   - Each 1536-dimension embedding uses ~6KB of storage
   - Consider using fewer dimensions if possible
   - Monitor your database size regularly

3. **Best Practices**:
   - Always normalize embeddings before storage
   - Store original text alongside embeddings
   - Use batching for bulk operations
   - Implement caching for frequently accessed embeddings

## 5. HNSW Indexes

HNSW (Hierarchical Navigable Small World) indexes significantly improve similarity search performance. According to Supabase's benchmarks, HNSW indexes can be up to 10,000 times faster than sequential scans and significantly faster than IVFFlat indexes.

### Understanding HNSW Indexes

HNSW indexes work by:
- Creating a hierarchical graph structure for fast approximate nearest neighbor search
- Providing better accuracy and query performance than IVFFlat indexes
- Using more memory to achieve better performance (trade-off to consider)

### Configure HNSW Index

We've already defined our HNSW index in `db/schema.ts`:

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
```

The parameters explained:
- `m`: Controls the maximum number of connections per element (16 is a good default)
- `ef_construction`: Controls index quality during construction (64 is a good default)
- `vector_cosine_ops`: Uses cosine distance for similarity calculations

To create the index, you can:

1. **Use Drizzle Migrations**:
```typescript:drizzle/0000_create_hnsw_index.sql
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 16,
  ef_construction = 64
);
```

2. **Or Execute Directly**:
```typescript
import { db } from "./db";
import { vectorIndexSQL } from "./db/schema";

// Create the HNSW index
await db.execute(vectorIndexSQL);
```

### Monitoring and Maintenance

1. **Check Index Size**:
```sql
SELECT pg_size_pretty(pg_relation_size('documents_embedding_idx'));
```

2. **Monitor Index Usage**:
```sql
SELECT 
  schemaname,
  relname,
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexrelname = 'documents_embedding_idx';
```

3. **Analyze Table for Better Query Planning**:
```sql
ANALYZE documents;
```

### Performance Tuning

1. **Adjust HNSW Parameters**:
```sql
-- For better search quality (slower indexing)
CREATE INDEX documents_embedding_idx ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 32,              -- Increased from 16
  ef_construction = 128 -- Increased from 64
);

-- For faster indexing (slightly lower quality)
CREATE INDEX documents_embedding_idx ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 8,              -- Decreased from 16
  ef_construction = 32 -- Decreased from 64
);
```

2. **Set Search Quality Parameter**:
```sql
-- Increase search quality at runtime
SET hnsw.ef_search = 100; -- Default is usually 40

-- Reset to default
SET hnsw.ef_search = 40;
```

### Important Considerations

1. **Memory Usage**:
   - HNSW indexes are memory-intensive
   - Index size grows with both data size and dimension count
   - Monitor memory usage when working with large datasets

2. **Build Time vs Query Time**:
   - Higher `m` and `ef_construction` values increase build time
   - Higher `ef_search` increases query time but improves accuracy
   - Find the right balance for your use case

3. **When to Rebuild**:
   - After significant data changes
   - When changing index parameters
   - When performance degrades

```sql
-- Rebuild index
REINDEX INDEX documents_embedding_idx;
```

4. **Backup Considerations**:
   - HNSW indexes are included in regular backups
   - Consider rebuilding after restoration for optimal performance

## 6. Database Utilities

Create utility functions for common database operations.

Create `db/utils.ts`:
```typescript:db/utils.ts
import { db } from "./index";
import { documents, users } from "./schema";
import { generateEmbedding } from "../lib/embeddings";
import { eq } from "drizzle-orm";

export async function createDocument({
  userId,
  title,
  content,
}: {
  userId: string;
  title: string;
  content: string;
}) {
  const embedding = await generateEmbedding(content);
  
  return await db.insert(documents).values({
    userId,
    title,
    content,
    embedding,
  }).returning();
}

export async function updateDocument({
  id,
  title,
  content,
}: {
  id: string;
  title?: string;
  content?: string;
}) {
  const updates: Partial<typeof documents.$inferInsert> = {};
  
  if (title) updates.title = title;
  if (content) {
    updates.content = content;
    updates.embedding = await generateEmbedding(content);
  }
  
  return await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id))
    .returning();
}

export async function deleteDocument(id: string) {
  return await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning();
}
```

## 7. Wrap-Up & Next Steps

- **Summary**:
  - Implemented Drizzle ORM for type-safe database operations
  - Set up a migration system for managing schema changes
  - Configured pgvector for embedding storage
  - Optimized vector searches with HNSW indexes
  - Created utility functions for common database operations

- **Preview of Next Video**:
  In the next video, we'll focus on setting up a comprehensive testing infrastructure, including unit tests, integration tests, and end-to-end tests to ensure our application's reliability.

## Additional Resources
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)
- [Supabase Vector Store Guide](https://supabase.com/docs/guides/database/extensions/pgvector)

## Additional Setup Requirements

Add these environment variables to `.env`:
```env
DATABASE_URL="postgres://..."
OPENAI_API_KEY="sk-..."
```

Update your `package.json` dependencies:
```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "pg": "^8.11.3",
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/pg": "^8.10.9"
  }
} 