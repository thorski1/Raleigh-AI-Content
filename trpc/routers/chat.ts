import { baseProcedure } from "../init";
import { z } from "zod";

export const chatAction = baseProcedure
  .input(z.object({
    message: z.string(),
  }),
).mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
    return { message: input.message };
  });
