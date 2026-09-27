module.exports.config = { api: { bodyParser: false } };

const fs = require("fs");
const { formidable } = require("formidable");
const { put, issueSignedToken, presignUrl } = require("@vercel/blob");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getSingle(value) {
  return Array.isArray(value) ? value[0] : value;
}

function safeName(value) {
  return String(value || "document")
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 240) || "document";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

  const contentTypeHeader = String(req.headers["content-type"] || "");

  try {
    // Small files use a normal server-side Blob upload. This is deliberately
    // below Vercel's serverless request limit and avoids browser presigned PUT
    // edge cases for common PDFs/docs.
    if (contentTypeHeader.startsWith("multipart/form-data")) {
      const form = formidable({
        multiples: false,
        maxFileSize: SERVER_UPLOAD_LIMIT,
        keepExtensions: true,
        allowEmptyFiles: false
      });
      const [fields, files] = await form.parse(req);
      const uploaded = getSingle(files.file);
      if (!uploaded) return json(res, 400, { message: "Document file is required." });

      const pathnameValue = getSingle(fields.pathname);
      const pathname = String(pathnameValue || "");
      if (!pathname.startsWith("vault/files/") || pathname.includes("..") || pathname.length > 500) {
        return json(res, 400, { message: "Invalid vault upload path." });
      }

      const stat = fs.statSync(uploaded.filepath);
      if (stat.size < 1 || stat.size > SERVER_UPLOAD_LIMIT) {
        return json(res, 400, { message: "Files up to 4 MB use the secure server upload path." });
      }

      const blob = await put(pathname, fs.createReadStream(uploaded.filepath), {
        access: "private",
        contentType: String(uploaded.mimetype || "application/octet-stream")
      });

      return json(res, 200, {
        uploaded: true,
        pathname: blob.pathname || pathname,
        contentType: blob.contentType || uploaded.mimetype || "application/octet-stream",
        size: stat.size
      });
    }

    // Larger files use a short-lived, pathname-scoped signed PUT URL so the
    // browser can upload directly to private Blob without exposing credentials.
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
    if (!Number.isFinite(size) || size < 1 || size > MAX_FILE_SIZE) {
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

    return json(res, 200, {
      presignedUrl,
      pathname,
      contentType,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
  } catch (error) {
    const message = String(error?.message || "Could not upload document.");
    if (/maxFileSize|larger than the maximum|too large/i.test(message)) {
      return json(res, 400, { message: "Files up to 4 MB use the server upload path. Larger files use direct secure upload." });
    }
    return json(res, 400, { message });
  }
};
