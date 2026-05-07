import { sql } from "./postgres.ts";

export type AppUserRow = {
  id: number;
  email: string;
  password_hash: string;
};

export async function findUserByEmail(
  email: string,
): Promise<AppUserRow | null> {
  const rows = await sql<AppUserRow[]>`
    SELECT id, email, password_hash
    FROM app_user
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findUserById(id: number): Promise<AppUserRow | null> {
  const rows = await sql<AppUserRow[]>`
    SELECT id, email, password_hash
    FROM app_user
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO app_user (email, password_hash)
    VALUES (${email.trim().toLowerCase()}, ${passwordHash})
    RETURNING id
  `;
  return rows[0]!.id;
}
