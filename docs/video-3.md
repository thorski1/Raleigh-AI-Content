# Implementing tRPC in a Next.js 14 Application

## 1. Setting up the tRPC Router and Procedures

The first step in implementing tRPC is setting up our initialization file. This file establishes the core tRPC instance and defines our base router and procedures.

Key aspects of this setup:

- We initialize tRPC with a typed context
- We configure superjson as our transformer to handle complex data types
- We create and export base utilities that will be used throughout our tRPC implementation
- We use React's cache function to ensure consistent context across server components

/trpc/init.ts

```ts
import { initTRPC } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';
import { appRouter } from './routers/_app';

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<typeof createTRPCContext>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;

// Add this new export
export const createCallerFactory = t.createCallerFactory;
```

/trpc/query-client.ts

```ts
'use client'; // <-- to make sure we can mount the Provider from a server component
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

function getUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

This file sets up the React Query client with tRPC:

- We're using `@tanstack/react-query` for managing server state in React.
- `superjson` is used for serialization, allowing us to preserve data types when transferring between client and server.
- We set a `staleTime` of 30 seconds, meaning data will be considered fresh for 30 seconds before refetching.
- The `dehydrate` and `hydrate` options are configured to work with Server-Side Rendering (SSR) in Next.js, ensuring that server-rendered data can be properly serialized and deserialized.

## 3. Server-Side tRPC Setup

/trpc/server.tsx

```ts
import 'server-only'; // <-- ensure this file cannot be imported from the client
import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { cache } from 'react';
import { createTRPCContext, createCallerFactory } from './init';
import { makeQueryClient } from './query-client';
import { appRouter } from './routers/_app';
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

const caller = createCallerFactory(appRouter)(createTRPCContext);

export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient,
);
```

This file sets up tRPC for server-side usage in Next.js:

- The `'server-only'` import ensures this file is only used on the server.
- We're using `createHydrationHelpers` from `@trpc/react-query/rsc`, which provides utilities for React Server Components.
- The `cache` function from React is used to memoize the query client, ensuring we use the same client for a given request.
- We create a `caller` using the `appRouter` and `createTRPCContext`.
- Finally, we export `trpc` and `HydrateClient`, which will be used for hydrating the client-side state with server-side data.

## 4. Client-Side tRPC Setup

/trpc/client.tsx

```ts
'use client'; // <-- to make sure we can mount the Provider from a server component
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

function getUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

This file sets up the client-side tRPC configuration:

- We use `'use client'` to mark this as a client component.
- We create a tRPC client using `createTRPCReact` and type it with our `AppRouter`.
- The `getUrl` function determines the API URL based on the environment.
- We create a `TRPCProvider` component that sets up both the tRPC client and the React Query client.
- The `httpBatchLink` is used to send API requests, with `superjson` for serialization.

## 5. Defining the App Router

/trpc/routers/\_app.ts

```ts
import { createTRPCRouter } from "../init";
import { chatAction } from "./chat";

export const appRouter = createTRPCRouter({
  chatAction,
});

export type AppRouter = typeof appRouter;
```

This file defines the main tRPC router:

- We import `chatAction` from a separate file, promoting modularity.
- The `appRouter` is created using `createTRPCRouter`, which likely comes from your tRPC initialization.
- We export the `AppRouter` type, which will be used to type the client.

## 6. Implementing a Chat Action

/trpc/routers/chat.ts

```ts
import { baseProcedure } from "../init";
import { z } from "zod";

export const chatAction = baseProcedure
  .input(z.object({
    message: z.string(),
  }),
).mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
    return { message: input.message };
  });
```

This file defines a specific tRPC procedure for chat actions:

- We use `baseProcedure` as the starting point.
- The input is validated using Zod, expecting an object with a `message` string.
- This is set up as a mutation, suitable for actions that modify data.
- For now, it simply echoes back the input message.

## 7. Setting up the tRPC API Route

/app/api/trpc/[trpc].ts

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/trpc/routers/_app';
import { createTRPCContext } from '@/trpc/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

This file sets up the API route for tRPC in Next.js:

- We use `fetchRequestHandler` from `@trpc/server/adapters/fetch`, which is suitable for Next.js 13+ API routes.
- The `appRouter` is passed in, along with the `createTRPCContext` function.
- We export the handler for both GET and POST methods, allowing tRPC to handle different types of requests.

This setup allows your Next.js application to handle tRPC requests, providing a typesafe API layer between your client and server.
