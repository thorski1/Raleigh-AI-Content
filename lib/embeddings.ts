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

// Utility to combine multiple text fields for embedding
export function prepareForEmbedding(doc: { title: string; content: string }): string {
  return `${doc.title}\n\n${doc.content}`.trim();
} 