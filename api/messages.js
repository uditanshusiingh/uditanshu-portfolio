const { list, get, put, del } = require("@vercel/blob");
const { randomUUID } = require("crypto");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

const PREFIX = "messages/";
const MAX_NAME = 120;
const MAX_EMAIL = 180;
const MAX_SUBJECT = 220;
const MAX_MESSAGE = 10000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPath(pathname) {
  return typeof pathname === "string" && pathname.startsWith(PREFIX) && pathname.endsWith(".json") && !pathname.includes("..") && pathname.length < 300;
}

async function listMessages() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    blobs.push(...(page.blobs || []));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const messages = [];
  for (const blob of blobs) {
    try {
      const result = await get(blob.pathname, { access: "private", useCache: false });
      if (!result?.stream) continue;
      const message = await new Response(result.stream).json();
      messages.push({ ...message, pathname: blob.pathname });
    } catch {
      // Ignore a malformed/deleted object instead of breaking the inbox.
    }
  }

  return messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function requireAdmin(req, res) {
  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) {
    json(res, 401, { message: "Unauthorized" });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!(await requireAdmin(req, res))) return;
      const messages = await listMessages();
      return json(res, 200, { messages, unreadCount: messages.filter(x => !x.read && !x.archived).length });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      body = body && typeof body === "object" ? body : {};

      // Public contact submission.
      if (!body.action) {
        if (clean(body.website, 200)) return json(res, 200, { success: true });
        const name = clean(body.name, MAX_NAME);
        const email = clean(body.email, MAX_EMAIL);
        const subject = clean(body.subject, MAX_SUBJECT);
        const message = clean(body.message, MAX_MESSAGE);
        if (!name || !validEmail(email) || !subject || !message) {
          return json(res, 400, { message: "Please provide a valid name, email, subject and message." });
        }

        const now = new Date().toISOString();
        const id = randomUUID();
        const pathname = PREFIX + Date.now() + "-" + id + ".json";
        const record = {
          id,
          name,
          email,
          subject,
          message,
          createdAt: now,
          read: false,
          starred: false,
          archived: false
        };

        await put(pathname, JSON.stringify(record), {
          access: "private",
          allowOverwrite: false,
          contentType: "application/json",
          cacheControlMaxAge: 0
        });
        return json(res, 201, { success: true });
      }

      if (!(await requireAdmin(req, res))) return;
      const action = String(body.action);
      const pathname = String(body.pathname || "");
      if (!validPath(pathname)) return json(res, 400, { message: "Invalid message." });

      const current = await get(pathname, { access: "private", useCache: false });
      if (!current?.stream) return json(res, 404, { message: "Message not found." });
      const message = await new Response(current.stream).json();

      if (action === "delete") {
        await del(pathname);
        return json(res, 200, { success: true });
      }

      if (action === "update") {
        const next = {
          ...message,
          read: body.read === undefined ? Boolean(message.read) : Boolean(body.read),
          starred: body.starred === undefined ? Boolean(message.starred) : Boolean(body.starred),
          archived: body.archived === undefined ? Boolean(message.archived) : Boolean(body.archived)
        };
        await put(pathname, JSON.stringify(next), {
          access: "private",
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 0
        });
        return json(res, 200, { success: true, message: next });
      }

      return json(res, 400, { message: "Unknown message action." });
    }

    if (req.method === "DELETE") {
      if (!(await requireAdmin(req, res))) return;
      const url = new URL(req.url, "http://localhost");
      const pathname = url.searchParams.get("pathname") || "";
      if (!validPath(pathname)) return json(res, 400, { message: "Invalid message." });
      await del(pathname);
      return json(res, 200, { success: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return json(res, 405, { message: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { message: error?.message || "Message service failed." });
  }
};
