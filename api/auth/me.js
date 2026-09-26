const { COOKIE_NAME, getCookie, verifySession } = require("./_session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = getCookie(req, COOKIE_NAME);
    const session = verifySession(token);

    res.setHeader("Cache-Control", "no-store");

    if (!session) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      user: { email: session.email }
    });
  } catch {
    return res.status(500).json({ message: "Authentication service is unavailable." });
  }
};
