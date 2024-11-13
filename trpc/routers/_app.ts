import { createTRPCRouter } from "../init";
import { chatAction } from "./chat";

export const appRouter = createTRPCRouter({
  chatAction,
});

export type AppRouter = typeof appRouter;