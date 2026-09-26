const { get } = require("@vercel/blob");
const { Readable } = require("node:stream");
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
    const filename = url.searchParams.get("name") || pathname?.split("/").pop() || "document";

    if (!validPath(pathname)) return json(res, 400, { message: "Invalid vault file." });

    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return json(res, 404, { message: "Document not found." });
    }

    const safeFilename = String(filename)
      .replace(/[\\"]/g, "_")
      .replace(/[\r\n]/g, "")
      .slice(0, 240) || "document";

    res.statusCode = 200;
    res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    if (result.blob.size != null) res.setHeader("Content-Length", String(result.blob.size));

    return Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    return json(res, 500, { message: error?.message || "Document download failed." });
  }
};
