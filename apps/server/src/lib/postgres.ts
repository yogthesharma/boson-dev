import postgres from "postgres";

import { config } from "../config.ts";

export const sql = postgres(config.databaseUrl, { max: 5 });

export async function pingPostgres(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
