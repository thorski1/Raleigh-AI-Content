/**
 * OpenAI Mock Module
 * Provides mock implementations for OpenAI API operations
 * @module openai-mock
 */

import { vi } from "vitest";

/**
 * Mock OpenAI Client Configuration
 * Provides consistent mock responses for OpenAI operations
 * @constant
 * @example
 * // Using mock OpenAI client
 * const embedding = await mockOpenAI.embeddings.create();
 * expect(embedding.data[0].embedding).toHaveLength(1536);
 */
export const mockOpenAI = {
  embeddings: {
    /**
     * Mock Embedding Creation
     * Returns a consistent 1536-dimensional vector
     * @returns {Promise<{data: Array<{embedding: number[]}>}>}
     */
    create: vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0) }],
    }),
  },
  chat: {
    completions: {
      /**
       * Mock Chat Completion
       * Returns a consistent mock response
       * @returns {Promise<{choices: Array<{message: {content: string}}>}>}
       */
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: { content: "Mock response" },
          },
        ],
      }),
    },
  },
};

/**
 * OpenAI Module Mock Configuration
 * Automatically mocks the entire OpenAI module
 * @constant
 */
vi.mock("openai", () => ({
  default: vi.fn(() => mockOpenAI),
  OpenAIApi: vi.fn(() => mockOpenAI),
}));

/**
 * Type Definitions
 */

/**
 * OpenAI Embedding Response
 * @typedef {Object} EmbeddingResponse
 * @property {Array<{embedding: number[]}>} data - Array of embedding vectors
 */
type EmbeddingResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

/**
 * OpenAI Chat Completion Response
 * @typedef {Object} ChatCompletionResponse
 * @property {Array<{message: {content: string}}>} choices - Array of completion choices
 */
type ChatCompletionResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};
