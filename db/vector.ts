import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    const dt =
      !!config && typeof config.dimensions === "number"
        ? `vector(${config.dimensions})`
        : "vector";
    return dt;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value !== "string") {
      throw new Error("Expected string value from database");
    }
    return JSON.parse(value);
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
});
