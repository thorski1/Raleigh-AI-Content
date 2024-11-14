import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env" });

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
