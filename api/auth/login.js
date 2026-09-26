const crypto = require("crypto");
const { createSession, sessionCookie } = require("./_session");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    return res.status(500).json({
      message: "Admin authentication is not configured on the server."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const validEmail = safeEqual(email, configuredEmail.trim().toLowerCase());
  const validPassword = safeEqual(password, configuredPassword);

  if (!validEmail || !validPassword) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = createSession(email);

  res.setHeader("Set-Cookie", sessionCookie(token));
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    authenticated: true,
    user: { email }
  });
};
