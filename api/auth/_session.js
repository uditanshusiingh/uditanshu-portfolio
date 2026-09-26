const crypto = require("crypto");

const COOKIE_NAME = "portfolio_admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function createSession(email) {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    jti: crypto.randomBytes(16).toString("hex")
  };
  const body = base64url(JSON.stringify(payload));
  return body + "." + sign(body);
}

function verifySession(token) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = sign(body);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const cookies = header.split(";").map(part => part.trim());

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index === -1) continue;

    const key = cookie.slice(0, index);
    const value = cookie.slice(index + 1);

    if (key === name) return decodeURIComponent(value);
  }

  return null;
}

function sessionCookie(token) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${MAX_AGE}`
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0"
  ].join("; ");
}

module.exports = {
  COOKIE_NAME,
  createSession,
  verifySession,
  getCookie,
  sessionCookie,
  clearSessionCookie
};
