# Video 5: Testing Infrastructure (30 min)

## 1. Introduction (2-3 minutes)

### Recap of Previous Video
In our last video, we established our database foundation with:
- Drizzle ORM implementation for type-safe database operations
- pgvector setup for efficient embedding storage
- Utility functions for common database operations
- HNSW indexes for optimized vector similarity search

### Objectives for This Video
We'll be building a comprehensive testing infrastructure that includes:
- Vitest setup with TypeScript and React support
- Isolated test database configuration
- Mock utilities for external services (OpenAI, Clerk)
- Integration tests for core features
- Debug logging system for test troubleshooting

## 2. Project Setup (5 minutes)

### Install Dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitejs/plugin-react jsdom
```


### Create Test Environment File

```bash
touch .env.test
```


Add to .env.test:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/test_db
DIRECT_URL=postgres://postgres:postgres@localhost:5432/test_db
```

## 3. Base Configuration (5 minutes)

### Create Vitest Config
Create `vitest.config.ts`:

```typescript
// Show the actual vitest.config.ts content we have
```


### Setup Test Environment
Create `tests/setup.ts`:

```typescript
// Show the actual tests/setup.ts content we have
```

## 4. Database Test Infrastructure (7 minutes)

### Create Database Helper
Create `tests/helpers/database.ts`:

```typescript
// Show the actual tests/helpers/database.ts content we have
```

### Create Test Environment Setup
Create `tests/helpers/setup-test-env.ts`:

```typescript
// Show the actual tests/helpers/setup-test-env.ts content we have
```

## 5. Mock Implementations (8 minutes)

### Create Service Mocks
Create mock files for external services:

1. `tests/mocks/clerk.ts`:
```typescript
// Show the actual tests/mocks/clerk.ts content we have
```

2. `tests/mocks/openai.ts`:
```typescript
// Show the actual tests/mocks/openai.ts content we have
```

3. `tests/mocks/db.ts`:
```typescript
// Show the actual tests/mocks/db.ts content we have
```


## 6. Test Fixtures (5 minutes)

### Create Test Fixtures
Create `tests/utils/fixtures.ts`:

```typescript
// Show the actual tests/utils/fixtures.ts content we have
```


## 7. Integration Tests (10 minutes)

### Create Test Suites

1. `tests/integration/auth.test.ts`:

```typescript
// Show the actual tests/integration/auth.test.ts content we have
```


2. `tests/integration/documents.test.ts`:

```typescript
// Show the actual tests/integration/documents.test.ts content we have
```


## 8. Running Tests (3 minutes)

### Add NPM Scripts
Add to package.json:

```json
{
"scripts": {
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage",
"test:ci": "vitest run"
}
}
```


### Test Execution

```bash
Create test database
psql postgres -c 'CREATE DATABASE test_db;'
Enable vector extension
psql test_db -c 'CREATE EXTENSION IF NOT EXISTS vector;'
Run tests
pnpm test
```


## 9. Debug System (5 minutes)

### Add Debug Utilities
Show how we've implemented debug logging across test files:

```typescript
const debug = {
log: (...args: unknown[]) => console.log("[Context]", ...args),
error: (...args: unknown[]) => console.error("[Context Error]", ...args),
};
```


## 10. Wrap-Up (2 minutes)

### Key Takeaways
- Structured test organization
- Type-safe testing with TypeScript
- Isolated test database setup
- Comprehensive mocking system
- Debug-friendly test infrastructure

### Next Steps
- Setting up GitHub Actions CI/CD
- Adding more specific test cases
- Implementing E2E tests
- Adding performance testing


