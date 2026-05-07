import { SignJWT, jwtVerify } from "jose";

const alg = "HS256";
const issuer = "boson";
const audience = "boson-web";

export async function signUserToken(
  secret: string,
  userId: number,
  email: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ email })
    .setProtectedHeader({ alg })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("30d")
    .setIssuer(issuer)
    .setAudience(audience)
    .sign(key);
}

export async function verifyUserToken(
  secret: string,
  token: string,
): Promise<{ sub: string; email: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience,
    algorithms: [alg],
  });
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  return { sub, email };
}
