const { issueSignedToken, presignUrl } = require("@vercel/blob");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

  try {
    const body = req.body || {};
    const pathname = String(body.pathname || "");
    const contentType = String(body.contentType || "application/octet-stream");
    const size = Number(body.size || 0);

    if (!pathname.startsWith("vault/files/")) {
      return json(res, 400, { message: "Invalid vault upload path." });
    }
    if (!pathname.includes(".") || pathname.length > 500) {
      return json(res, 400, { message: "Invalid vault filename." });
    }
    if (!Number.isFinite(size) || size < 1 || size > 5 * 1024 * 1024 * 1024) {
      return json(res, 400, { message: "File size must be between 1 byte and 5 GB." });
    }

    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      allowedContentTypes: [contentType],
      maximumSizeInBytes: size,
      validUntil: Date.now() + 15 * 60 * 1000
    });

    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: "put",
      access: "private",
      validUntil: Date.now() + 15 * 60 * 1000
    });

    return json(res, 200, { presignedUrl, pathname, contentType, expiresAt: Date.now() + 15 * 60 * 1000 });
  } catch (error) {
    return json(res, 400, { message: error?.message || "Could not create a secure vault upload URL." });
  }
};
