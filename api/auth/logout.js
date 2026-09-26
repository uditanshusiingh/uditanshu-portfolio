const { clearSessionCookie } = require("./_session");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({ authenticated: false });
};
