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

export async function updateDocument({
  id,
  content,
  metadata,
}: {
  id: number;
  content?: string;
  metadata?: Record<string, any>;
}) {
  const updates: Partial<typeof documents.$inferInsert> = {};
  
  if (content) {
    updates.content = content;
    updates.embedding = await generateEmbedding(content);
  }
  if (metadata) {
    updates.metadata = metadata;
  }
  
  return await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id))
    .returning();
}

export async function deleteDocument(id: number) {
  return await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning();
} 