const { list, get, put, del } = require("@vercel/blob");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

const PREFIX = "vault/files/";
const MANIFEST = "vault/manifest.json";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function safeName(value) {
  return String(value || "document")
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 240) || "document";
}

async function readManifest() {
  const result = await get(MANIFEST, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return {};
  try {
    return JSON.parse(await new Response(result.stream).text());
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  await put(MANIFEST, JSON.stringify(manifest), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
}

async function listAll() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    blobs.push(...(page.blobs || []));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function validPath(pathname) {
  return typeof pathname === "string" && pathname.startsWith(PREFIX) && pathname.length > PREFIX.length && !pathname.includes("..");
}

module.exports = async function handler(req, res) {
  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const [blobs, manifest] = await Promise.all([listAll(), readManifest()]);
      const documents = blobs.map(blob => {
        const meta = manifest[blob.pathname] || {};
        return {
          pathname: blob.pathname,
          name: meta.originalName || blob.pathname.split("/").pop(),
          size: blob.size || 0,
          uploadedAt: blob.uploadedAt || meta.uploadedAt || new Date().toISOString(),
          contentType: meta.contentType || "application/octet-stream",
          lastModified: meta.lastModified || null,
          pinned: Boolean(meta.pinned)
        };
      }).sort((a,b) => Number(b.pinned) - Number(a.pinned) || new Date(b.uploadedAt) - new Date(a.uploadedAt));

      return json(res, 200, { documents });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { message: "Method not allowed" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = String(body.action || "");
    const pathname = String(body.pathname || "");

    if (action === "register") {
      if (!validPath(pathname)) return json(res, 400, { message: "Invalid vault file." });
      const manifest = await readManifest();
      manifest[pathname] = {
        originalName: safeName(body.originalName || pathname.split("/").pop()),
        contentType: String(body.contentType || "application/octet-stream").slice(0, 180),
        uploadedAt: body.uploadedAt || new Date().toISOString(),
        lastModified: body.lastModified || null,
        pinned: false
      };
      await writeManifest(manifest);
      return json(res, 200, { success: true });
    }

    if (action === "pin") {
      if (!validPath(pathname)) return json(res, 400, { message: "Invalid vault file." });
      const manifest = await readManifest();
      manifest[pathname] = {
        ...(manifest[pathname] || {}),
        originalName: safeName(body.originalName || manifest[pathname]?.originalName || pathname.split("/").pop()),
        pinned: Boolean(body.pinned)
      };
      await writeManifest(manifest);
      return json(res, 200, { success: true, pinned: Boolean(body.pinned) });
    }

    if (action === "delete") {
      if (!validPath(pathname)) return json(res, 400, { message: "Invalid vault file." });
      await del(pathname);
      const manifest = await readManifest();
      delete manifest[pathname];
      await writeManifest(manifest);
      return json(res, 200, { success: true });
    }

    return json(res, 400, { message: "Unknown vault action." });
  } catch (error) {
    return json(res, 500, { message: error?.message || "Vault operation failed." });
  }
};
