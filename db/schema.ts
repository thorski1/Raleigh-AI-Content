import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { vector } from "./vector";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  profileImageUrl: text("profile_image_url"),
});

// Content table with status enum
export const content = pgTable("content", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] }).default(
    "draft",
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Metadata table
export const metadata = pgTable("metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => content.id, {
    onDelete: "cascade",
  }),
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
  `,
};
