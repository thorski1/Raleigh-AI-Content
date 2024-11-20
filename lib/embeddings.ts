import { OpenAI } from "openai";

export function prepareForEmbedding({
  title,
  content,
}: { title: string; content: string }) {
  return `${title}\n\n${content}`.trim();
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}
