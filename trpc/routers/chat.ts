import { z } from "zod";
import { baseProcedure } from "../init";

export const chatAction = baseProcedure.input(z.object({
    message: z.string(),
  })).mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
    return { message: input.message };
  });