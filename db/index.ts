import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema.js";
import * as tournaments from "./tournament-schema.js";

export const db = drizzle({ schema: { ...schema, ...tournaments } });
