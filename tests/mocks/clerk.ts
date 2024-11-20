/**
 * Clerk Authentication Mock Module
 * Provides mock implementations for Clerk authentication in tests
 * @module clerk-mock
 */

import { vi } from 'vitest';

/**
 * Mock User Interface
 * Represents the structure of a mocked Clerk user
 * @interface MockUser
 * @property {string} id - Unique identifier for the user
 * @property {string} email - User's email address
 * @property {string} [username] - Optional username
 */
interface MockUser {
  id: string;
  email: string;
  username?: string;
}

/**
 * Current mock user state
 * Maintains the currently active mock user throughout tests
 * @type {MockUser | null}
 */
let currentUser: MockUser | null = null;

/**
 * Sets the current mock user for testing
 * Updates the global mock user state used by Clerk mocks
 * @function
 * @param {MockUser | null} user - User object to set as current, or null to clear
 * @example
 * // Set mock user
 * mockClerkUser({
 *   id: 'user_123',
 *   email: 'test@example.com',
 *   username: 'testuser'
 * });
 * 
 * // Clear mock user
 * mockClerkUser(null);
 */
export function mockClerkUser(user: MockUser | null) {
  currentUser = user;
}

/**
 * Clerk Module Mock Configuration
 * Provides comprehensive mocking of Clerk authentication functionality
 * @constant
 * @example
 * // Mock usage in tests:
 * const { auth } = await import('@clerk/nextjs/server');
 * const session = await auth();
 * console.log(session.userId); // Returns current mock user ID
 */
vi.mock('@clerk/nextjs/server', () => ({
  /**
   * Mock auth function
   * Simulates Clerk's auth() function for testing
   * @returns {Object} Mock auth session
   */
  auth: vi.fn().mockImplementation(() => {
    if (!currentUser) {
      return { userId: null };
    }
    return { userId: currentUser.id };
  }),

  /**
   * Mock currentUser function
   * Returns the current mock user state
   * @returns {MockUser | null} Current mock user or null
   */
  currentUser: vi.fn().mockImplementation(() => currentUser),

  /**
   * Mock Clerk client implementation
   * Provides mock user management functions
   */
  clerkClient: {
    users: {
      /**
       * Mock getUser function
       * Simulates user retrieval from Clerk
       * @param {string} id - User ID to look up
       * @returns {MockUser | null} Matching user or null
       */
      getUser: vi.fn().mockImplementation((id) => {
        if (currentUser?.id === id) {
          return currentUser;
        }
        return null;
      }),
    },
  },
}));

/**
 * Type Definitions
 */

/**
 * Clerk Auth Session
 * @typedef {Object} ClerkAuthSession
 * @property {string | null} userId - ID of the authenticated user or null
 */
type ClerkAuthSession = {
  userId: string | null;
};

/**
 * Clerk Client Configuration
 * @typedef {Object} ClerkClientConfig
 * @property {Object} users - User management functions
 * @property {Function} users.getUser - Function to retrieve user by ID
 */
type ClerkClientConfig = {
  users: {
    getUser: (id: string) => Promise<MockUser | null>;
  };
}; 