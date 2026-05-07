import { Hono } from "hono";

import { config } from "../config.ts";
import { signUserToken } from "../lib/jwt.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import {
  createUser,
  findUserByEmail,
} from "../lib/users-repo.ts";

export const authPublicRoutes = new Hono();

authPublicRoutes.post("/auth/register", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }
  if (!raw || typeof raw !== "object") {
    return c.json({ ok: false, error: "Expected JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !email.includes("@")) {
    return c.json({ ok: false, error: "Valid email is required" }, 400);
  }
  if (password.length < 4) {
    return c.json({ ok: false, error: "Password must be at least 4 characters" }, 400);
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return c.json({ ok: false, error: "Email already registered" }, 409);
  }

  const id = await createUser(email, hashPassword(password));
  const token = await signUserToken(config.jwtSecret, id, email);
  return c.json({
    ok: true,
    token,
    user: { id, email },
  });
});

authPublicRoutes.post("/auth/login", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }
  if (!raw || typeof raw !== "object") {
    return c.json({ ok: false, error: "Expected JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return c.json({ ok: false, error: "email and password required" }, 400);
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ ok: false, error: "Invalid email or password" }, 401);
  }

  const token = await signUserToken(config.jwtSecret, user.id, user.email);
  return c.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email },
  });
});
