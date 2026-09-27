const { issueSignedToken, presignUrl } = require("@vercel/blob");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

const PREFIX = "vault/files/";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function validPath(pathname) {
  return typeof pathname === "string" && pathname.startsWith(PREFIX) && pathname.length > PREFIX.length && !pathname.includes("..");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { message: "Method not allowed" });
  }

  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.searchParams.get("pathname");
    const view = url.searchParams.get("view") === "1";

    if (!validPath(pathname)) return json(res, 400, { message: "Invalid vault file." });

    // Generate a short-lived, single-file signed GET URL. This lets the
    // browser render/download the exact private Blob object without exposing
    // the Blob store token and without proxying the file through the function.
    const token = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil: Date.now() + 10 * 60 * 1000
    });

    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: "get",
      access: "private",
      validUntil: Date.now() + 10 * 60 * 1000,
      useCache: false
    });

    res.statusCode = 302;
    res.setHeader("Location", presignedUrl);
    res.setHeader("Cache-Control", "private, no-store");
    return res.end();
  } catch (error) {
    return json(res, 404, { message: error?.message || "Document not found." });
  }
};
