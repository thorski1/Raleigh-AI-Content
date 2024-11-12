import { initTRPC, TRPCError } from "@trpc/server";
import { experimental_nextAppDirCaller } from "@trpc/server/adapters/next-app-dir";
import { currentUser, User } from "@clerk/nextjs/server";

export const t = initTRPC.context<Context>().create();

export const router = t.router;
export const procedure = t.procedure;

export const serverActionProcedure = t.procedure
  .experimental_caller(
    experimental_nextAppDirCaller({
      pathExtractor: ({ meta }) => (meta as Meta).span,
    }),
  )
  .use(async (opts) => {
    const user = await currentUser();
    return opts.next({ ctx: { user } });
  });

export const protectedProcedure = serverActionProcedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to do this",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  });
});