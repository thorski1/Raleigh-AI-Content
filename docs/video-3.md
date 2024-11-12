# Implementing tRPC in a Next.js 14 Application

## 1. Setting up the tRPC Router and Procedures

The first step in implementing tRPC is setting up our initialization file. This file establishes the core tRPC instance and defines our base router and procedures.

Key aspects of this setup:

- We initialize tRPC with a typed context
- We configure superjson as our transformer to handle complex data types
- We create and export base utilities that will be used throughout our tRPC implementation
- We use React's cache function to ensure consistent context across server components

/package.json

```json
"@trpc/client": "11.0.0-rc.532",
"@trpc/next": "^11.0.0-rc.532",
"@trpc/react-query": "11.0.0-rc.532",
"@trpc/server": "11.0.0-rc.532",
"@tanstack/react-query": "^5.56.2",
"superjson": "^2.2.1"
```

/trpc/init.ts
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/init.ts](init.ts)

/trpc/query-client.ts
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/query-client.ts](query-client.ts)

This file sets up the React Query client with tRPC:

- We're using `@tanstack/react-query` for managing server state in React.
- `superjson` is used for serialization, allowing us to preserve data types when transferring between client and server.
- We set a `staleTime` of 30 seconds, meaning data will be considered fresh for 30 seconds before refetching.
- The `dehydrate` and `hydrate` options are configured to work with Server-Side Rendering (SSR) in Next.js, ensuring that server-rendered data can be properly serialized and deserialized.

## 3. Server-Side tRPC Setup

/trpc/server.tsx
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/server.tsx](server.tsx)

This file sets up tRPC for server-side usage in Next.js:

- The `'server-only'` import ensures this file is only used on the server.
- We're using `createHydrationHelpers` from `@trpc/react-query/rsc`, which provides utilities for React Server Components.
- The `cache` function from React is used to memoize the query client, ensuring we use the same client for a given request.
- We create a `caller` using the `appRouter` and `createTRPCContext`.
- Finally, we export `trpc` and `HydrateClient`, which will be used for hydrating the client-side state with server-side data.

## 4. Client-Side tRPC Setup

/trpc/client.tsx
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/client.tsx](client.tsx)

This file sets up the client-side tRPC configuration:

- We use `'use client'` to mark this as a client component.
- We create a tRPC client using `createTRPCReact` and type it with our `AppRouter`.
- The `getUrl` function determines the API URL based on the environment.
- We create a `TRPCProvider` component that sets up both the tRPC client and the React Query client.
- The `httpBatchLink` is used to send API requests, with `superjson` for serialization.

## 5. Defining the App Router

/trpc/routers/\_app.ts
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/routers/_app.ts](_app.ts)

This file defines the main tRPC router:

- We import `chatAction` from a separate file, promoting modularity.
- The `appRouter` is created using `createTRPCRouter`, which likely comes from your tRPC initialization.
- We export the `AppRouter` type, which will be used to type the client.

## 6. Implementing a Chat Action

/trpc/routers/chat.ts
[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/trpc/routers/chat.ts](chat.ts)

This file defines a specific tRPC procedure for chat actions:

- We use `baseProcedure` as the starting point.
- The input is validated using Zod, expecting an object with a `message` string.
- This is set up as a mutation, suitable for actions that modify data.
- For now, it simply echoes back the input message.

## 7. Setting up the tRPC API Route

/app/api/trpc/[trpc].ts

[https://github.com/thorski1/Raleigh-AI-Content/blob/089a8e7be3ab370d05c3aa4a7cf0de91a73c0f43/app/api/%5Btrpc%5D/route.ts](route.ts)

This file sets up the API route for tRPC in Next.js:

- We use `fetchRequestHandler` from `@trpc/server/adapters/fetch`, which is suitable for Next.js 13+ API routes.
- The `appRouter` is passed in, along with the `createTRPCContext` function.
- We export the handler for both GET and POST methods, allowing tRPC to handle different types of requests.

This setup allows your Next.js application to handle tRPC requests, providing a typesafe API layer between your client and server.
