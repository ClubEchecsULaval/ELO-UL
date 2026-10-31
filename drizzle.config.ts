import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./db/schema.ts", "./db/tournament-schema.ts"],
  out: "netlify/database/migrations",
});
