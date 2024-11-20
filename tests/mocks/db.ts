/**
 * Database Mock Module
 * Provides comprehensive mocking for database operations in tests
 * @module database-mock
 */

import { vi } from "vitest";

/**
 * Mock Database Interface
 * Represents the structure of our mock database client
 * @interface MockDb
 * @property {Function} insert - Mocks database insert operations
 * @property {Function} select - Mocks database select operations
 * @property {Function} update - Mocks database update operations
 * @property {Function} delete - Mocks database delete operations
 * @property {Function} execute - Mocks raw SQL execution
 */
type MockDb = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  query: {
    documents: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    users: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  transaction: ReturnType<typeof vi.fn>;
};

/**
 * Mock Database Instance
 * Provides a fully mocked database client for testing
 * @constant
 * @example
 * // Using mock database in tests
 * const result = await mockDb.insert().returning();
 * expect(mockDb.insert).toHaveBeenCalled();
 */
export const mockDb: MockDb = {
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  select: vi.fn().mockReturnValue({ from: vi.fn() }),
  update: vi.fn().mockReturnValue({ set: vi.fn(), where: vi.fn() }),
  delete: vi.fn().mockReturnValue({ where: vi.fn() }),
  execute: vi.fn(),
  query: {
    documents: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    users: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  transaction: vi.fn().mockImplementation((fn) => fn(mockDb)),
};

/**
 * Reset Mock Functions
 * Clears all mock function calls and implementations
 * @function
 * @example
 * // Reset mocks between tests
 * beforeEach(() => {
 *   resetMocks();
 * });
 */
export function resetMocks(): void {
  vi.clearAllMocks();
  Object.values(mockDb).forEach((mock) => {
    if (typeof mock === "function") {
      (mock as ReturnType<typeof vi.fn>).mockClear();
    }
  });
}
