# Video 2: Authentication & Database Walkthrough

## 1. Introduction

In this guide, we'll set up user authentication using Clerk and configure a database with Supabase. We'll also implement connection pooling and protect specific routes to ensure secure access.

- **Recap of Previous Video**: In our last session, we set up the project environment, configured Biome for code quality, and established Git hooks to maintain code standards.

- **Objectives for This Video**:
  - Integrate Clerk for user authentication.
  - Design and implement the database schema.
  - Configure Supabase and its extensions.
  - Set up connection pooling for efficient database interactions.
  - Implement protected routes and middleware for security.

## 2. Clerk Authentication Setup

Clerk provides pre-built components and hooks for user authentication in Next.js applications.

- **What is Clerk?**: Clerk is a developer-first authentication and user management solution. It provides pre-built React components and hooks for sign-in, sign-up, user profile, and organization management.

- **Setting Up Clerk**:
  1. **Create a Clerk Account**: Sign up at [Clerk](https://clerk.com/).
  2. **Create a New Application**: In the Clerk dashboard, create a new application for your project.
  3. **Install Clerk SDK**: In your Next.js project directory, install the Clerk Next.js SDK:
     ```bash
     npm install @clerk/nextjs
     ```
  4. **Configure Environment Variables**: Create a `.env.local` file:
     ```env
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
     CLERK_SECRET_KEY=your_clerk_secret_key
     NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
     NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
     NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
     NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
     ```
  5. **Create Middleware**: Create a `middleware.ts` file in your project root:
     ```typescript
     import { authMiddleware } from "@clerk/nextjs";
      
     export default authMiddleware({
       publicRoutes: ["/", "/sign-in", "/sign-up"],
       ignoredRoutes: ["/api/public"]
     });
      
     export const config = {
       matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
     };
     ```
  6. **Wrap Your Application**: Update your `app/layout.tsx`:
     ```tsx
     import { ClerkProvider } from '@clerk/nextjs';
     
     export default function RootLayout({
       children,
     }: {
       children: React.ReactNode;
     }) {
       return (
         <ClerkProvider>
           <html lang="en">
             <body>{children}</body>
           </html>
         </ClerkProvider>
       );
     }
     ```

## 3. Database Schema Design

Designing a robust database schema is crucial for managing the platform's data effectively. For our AI-powered content platform, we'll define several key tables to handle user information, content, and metadata efficiently.

### Tables Setup

#### 1. Users Table
The **Users** table will store user-related information such as authentication details, profile information, and relevant timestamps.

- **Table Name**: `users`
- **Columns**:
  - `id`: UUID, Primary Key.
  - `email`: String, Unique, Not Null.
  - `username`: String, Unique, Nullable.
  - `created_at`: Timestamp, Default to current time.
  - `updated_at`: Timestamp, Updates automatically.
  - `profile_image_url`: String, Nullable, URL to the user's profile picture.

  **SQL Command to Create the Users Table**:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    profile_image_url TEXT
  );
  ```

#### 2. Content Table
The **Content** table is responsible for storing the main content data, such as articles, drafts, and related metadata.

- **Table Name**: `content`
- **Columns**:
  - `id`: UUID, Primary Key.
  - `user_id`: UUID, Foreign Key referencing `users(id)`, Not Null.
  - `title`: String, Not Null.
  - `body`: Text, Not Null.
  - `status`: Enum (`draft`, `published`, `archived`), Default to `draft`.
  - `created_at`: Timestamp, Default to current time.
  - `updated_at`: Timestamp, Updates automatically.

  **SQL Command to Create the Content Table**:
  ```sql
  CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

#### 3. Metadata Table
The **Metadata** table stores additional information related to the content, such as tags, categories, and other attributes that help in organizing and searching content effectively.

- **Table Name**: `metadata`
- **Columns**:
  - `id`: UUID, Primary Key.
  - `content_id`: UUID, Foreign Key referencing `content(id)`, Not Null.
  - `key`: String, Not Null.
  - `value`: String, Not Null.
  - `created_at`: Timestamp, Default to current time.

  **SQL Command to Create the Metadata Table**:
  ```sql
  CREATE TABLE metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

### Row Level Security (RLS)

For Supabase, we need to enable Row Level Security to ensure data protection:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can manage own content" ON content
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own metadata" ON metadata
  FOR ALL USING (
    content_id IN (
      SELECT id FROM content WHERE user_id = auth.uid()
    )
  );
```

## 4. Supabase Configuration & Extensions

Supabase offers a Postgres database with additional features like authentication and real-time subscriptions.

- **What is Supabase?**: Supabase is an open-source backend-as-a-service platform that provides Postgres databases, authentication, instant APIs, real-time data subscriptions, and more to help developers quickly build scalable applications.

- **Configuration**:
  1. **Create a Supabase Account**: Sign up at [Supabase](https://supabase.com/).
  2. **Create a New Project**: In the Supabase dashboard, create a new project and note the `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
  3. **Install Supabase Client**: In your Next.js project directory, install the Supabase client:
     ```bash
     npm install @supabase/supabase-js
     ```
  4. **Configure Environment Variables**: Add the following variables to your `.env.local` file:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
     Replace `your_supabase_url` and `your_supabase_anon_key` with the values from your Supabase dashboard.
  5. **Initialize Supabase Client**: Create a `lib/supabaseClient.ts` file to initialize the Supabase client:
     ```tsx
     import { createClient } from '@supabase/supabase-js';

     const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
     const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

     export const supabase = createClient(supabaseUrl, supabaseAnonKey);
     ```
  6. **Configure Extensions**: To enable the `pgvector` extension for vector similarity search, run the following SQL command in the Supabase SQL Editor:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
     This extension is essential for implementing features like the RAG engine in our platform.

- **Client Setup**:
  1. **Server-Side Client**: Create `lib/supabase/server.ts`:
     ```typescript
     import { createServerClient } from '@supabase/ssr'
     import { cookies } from 'next/headers'

     export function createClient() {
       const cookieStore = cookies()
       return createServerClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
         {
           cookies: {
             get(name: string) {
               return cookieStore.get(name)?.value
             },
           },
         }
       )
     }
     ```
  2. **Client-Side Client**: Create `lib/supabase/client.ts`:
     ```typescript
     import { createClient } from '@supabase/supabase-js';

     const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
     const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

     if (!supabaseUrl || !supabaseAnonKey) {
       throw new Error('Missing Supabase environment variables');
     }

     export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       auth: {
         persistSession: false // Since we're using Clerk for auth
       }
     });
     ```

## 5. Connection Pooling Setup

Connection pooling improves performance by reusing database connections.

- **Why Connection Pooling?**: Connection pooling allows multiple clients to share a pool of database connections, reducing the overhead of establishing new connections each time a request is made. This helps improve the performance and scalability of your application, especially during high traffic periods.

- **Implementation**:
  1. **pgBouncer Setup**: Supabase supports connection pooling via pgBouncer, which manages and reuses existing database connections.
  2. **Enable Connection Pooling in Supabase**:
     - Navigate to your Supabase project settings.
     - Under the **Database** tab, enable **Connection Pooling**.
     - Use the provided **Pooling Connection String** for your application.
  3. **Update Supabase Client Configuration**: In your `lib/supabaseClient.ts`, update the connection URL to use the pooling connection string provided by Supabase:
     ```tsx
     import { createClient } from '@supabase/supabase-js';

     const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
     const supabasePoolUrl = process.env.NEXT_PUBLIC_SUPABASE_POOL_URL!;
     const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

     export const supabase = createClient(supabasePoolUrl || supabaseUrl, supabaseAnonKey);
     ```
  4. **Environment Variables**: Add the following to your `.env.local` file:
     ```env
     NEXT_PUBLIC_SUPABASE_POOL_URL=your_supabase_pool_url
     ```
     Replace `your_supabase_pool_url` with the connection pooling string from Supabase.

## 6. Protected Routes & Middleware

Protect specific routes and implement authentication checks using Clerk's latest middleware and auth helpers.

### Middleware Implementation

1. **Create Middleware File**: Create a `middleware.ts` file in the root of your project:
```typescript
import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/", "/sign-in", "/sign-up"],
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ["/api/public"]
});
 
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### Protected Routes Implementation

1. **Server Component Protection**: Use the `auth()` helper to protect server components:
```typescript
import { auth } from "@clerk/nextjs";

export default async function ProtectedPage() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  return <div>Protected Page Content</div>;
}
```

2. **Route Handler Protection**: Protect API routes using `auth()`:
```typescript
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
 
export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  return NextResponse.json({ message: "Protected data!" });
}
```

3. **Using auth.protect()**: For more advanced authorization:
```typescript
import { auth } from "@clerk/nextjs";
 
export async function GET() {
  const { has } = await auth().protect({
    role: "admin",
    permission: "manage_posts"
  });
  
  // Check custom permissions
  if (!has({ permission: "delete_posts" })) {
    return new Response("Forbidden", { status: 403 });
  }
  
  return Response.json({ message: "Admin only data!" });
}
```

### Client Components Protection

1. **Conditional Rendering**: Use Clerk's components to conditionally render content:
```typescript
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function Page() {
  return (
    <>
      <SignedIn>
        <p>This content is only visible to signed in users</p>
      </SignedIn>
      <SignedOut>
        <p>This content is only visible to signed out users</p>
      </SignedOut>
    </>
  );
}
```

2. **Using Hooks**: Access auth state in client components:
```typescript
"use client";
 
import { useAuth } from "@clerk/nextjs";
 
export default function ProtectedClient() {
  const { isLoaded, userId } = useAuth();
  
  if (!isLoaded) return null;
  
  if (!userId) {
    return <div>Please sign in</div>;
  }
  
  return <div>Protected client content</div>;
}
```

### Server Actions Protection

For server actions in Next.js 14+, protect them using `auth()`:
```typescript
import { auth } from "@clerk/nextjs";

export async function submitData(formData: FormData) {
  "use server";
  
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  // Process authenticated form submission
}
```

### Best Practices

1. **Error Handling**: Always handle authentication errors gracefully:
   - Use try/catch blocks for auth checks
   - Provide meaningful error messages
   - Implement proper redirects for unauthorized access

2. **Route Organization**:
   - Keep protected routes under a common path (e.g., `/dashboard/*`)
   - Use consistent naming conventions for public vs protected routes
   - Document which routes require authentication

3. **Performance**:
   - Use appropriate auth checks based on the component type (server vs client)
   - Implement proper loading states while auth state is being determined
   - Cache auth state where appropriate to minimize redundant checks

4. **Security**:
   - Always verify authentication on both client and server
   - Implement proper CSRF protection
   - Use environment variables for sensitive configuration
   - Regular audit of protected routes and their access patterns

## 7. Wrap-Up & Next Steps

- **Summary**:
  - **Clerk Authentication**: We successfully integrated Clerk, set up user authentication flows, and wrapped our application in Clerk's provider to enable authentication across our platform.
  - **Database Schema Design**: We designed the core tables for the platform and set up Supabase as our database solution, complete with connection pooling for efficient performance.
  - **Protected Routes & Middleware**: Middleware was added to secure routes and ensure that only authenticated users can access protected parts of the application.

- **Preview of Next Video**:
  - In the next video, we'll be diving into building the **API Layer** and focusing on **type safety** using **tRPC**. We'll set up routers, convert API routes, and secure these routes with Clerk. Additionally, we'll cover request validation to ensure robust, type-safe communication between the frontend and backend of our platform.

## Additional Resources
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [tRPC Documentation](https://trpc.io/docs)

## Additional Setup Requirements

Add these dependencies to your `package.json`:
```json
{
  "dependencies": {
    "@clerk/nextjs": "^5.0.0",
    "@supabase/ssr": "^0.1.0",
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

Create a `.env.example` file:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_POOL_URL=
```

