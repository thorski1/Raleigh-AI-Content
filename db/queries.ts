import { sql } from "drizzle-orm";
import { and } from "drizzle-orm";
import { db } from "./index";
import { documents } from "./schema";

// Define similarity operators
export const SimilarityOperator = {
  Cosine: "<=>", // Cosine distance (most common)
  L2: "<->", // Euclidean distance
  InnerProduct: "<#>", // Negative inner product (dot product)
} as const;

type SimilarityOperatorType =
  (typeof SimilarityOperator)[keyof typeof SimilarityOperator];

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
  options: VectorSearchOptions = {},
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
      similarity: sql`1 - (embedding ${sql.raw(operator)} ${vectorQuery})`.as(
        "similarity",
      ),
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
  } = {},
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

/**
 * Hybrid search combining vector similarity and full-text search
 */
export async function hybridSearch(
  query: string,
  embedding: number[],
  {
    operator = SimilarityOperator.Cosine,
    limit = 5,
    threshold = 0.8,
    weightVector = 0.7, // Weight for vector similarity (0-1)
    weightText = 0.3, // Weight for text similarity (0-1)
  } = {},
) {
  const vectorQuery = sql`${sql.raw(`'[${embedding.join(",")}]'::vector`)}`;

  return await db.execute<{
    id: number;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>(sql`
    WITH vector_results AS (
      SELECT 
        id,
        content,
        metadata,
        1 - (embedding ${sql.raw(operator)} ${vectorQuery}) as vector_similarity
      FROM documents
      WHERE embedding ${sql.raw(operator)} ${vectorQuery} < ${1 - threshold}
    ),
    text_results AS (
      SELECT
        id,
        content,
        metadata,
        ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) as text_similarity
      FROM documents
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
    )
    SELECT 
      v.id,
      v.content,
      v.metadata,
      (v.vector_similarity * ${weightVector} + COALESCE(t.text_similarity, 0) * ${weightText}) as similarity
    FROM vector_results v
    LEFT JOIN text_results t ON v.id = t.id
    ORDER BY similarity DESC
    LIMIT ${limit};
  `);
}

/**
 * Get recommendations based on multiple documents
 */
export async function getRecommendations(
  documentIds: number[],
  {
    operator = SimilarityOperator.Cosine,
    limit = 5,
    threshold = 0.8,
  }: VectorSearchOptions = {},
) {
  if (documentIds.length === 0) {
    return [];
  }

  return await db.execute<{
    id: number;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>(sql`
    WITH document_embeddings AS (
      SELECT embedding
      FROM documents
      WHERE id = ANY(${documentIds})
    ),
    average_embedding AS (
      SELECT array_agg(embedding) as embeddings
      FROM document_embeddings
    )
    SELECT 
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding ${sql.raw(operator)} (
        SELECT unnest(embeddings)::vector
        FROM average_embedding
      )) as similarity
    FROM documents d
    WHERE 
      d.id != ALL(${documentIds})
      AND d.embedding ${sql.raw(operator)} (
        SELECT unnest(embeddings)::vector
        FROM average_embedding
      ) < ${1 - threshold}
    ORDER BY similarity DESC
    LIMIT ${limit};
  `);
}
