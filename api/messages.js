const { list, get, put, del } = require("@vercel/blob");
const crypto = require("crypto");
const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

var PREFIX = "messages/";
var MAX_NAME = 120;
var MAX_EMAIL = 180;
var MAX_SUBJECT = 220;
var MAX_MESSAGE = 10000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function clean(value, max) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPath(pathname) {
  return typeof pathname === "string" &&
    pathname.indexOf(PREFIX) === 0 &&
    pathname.slice(-5) === ".json" &&
    pathname.indexOf("..") === -1 &&
    pathname.length < 300;
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function newId() {
  return crypto.randomBytes(16).toString("hex");
}

async function readBlobJson(pathname) {
  var result = await get(pathname, { access: "private", useCache: false });
  if (!result || !result.stream) return null;
  var text = await streamToText(result.stream);
  return JSON.parse(text);
}

async function streamToText(stream) {
  var reader = stream.getReader();
  var chunks = [];
  var done = false;

  while (!done) {
    var part = await reader.read();
    done = part.done;
    if (!done && part.value) chunks.push(Buffer.from(part.value));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function listMessages() {
  var blobs = [];
  var cursor;

  do {
    var page = await list({
      prefix: PREFIX,
      limit: 1000,
      cursor: cursor
    });

    if (page && page.blobs) blobs = blobs.concat(page.blobs);
    cursor = page && page.hasMore ? page.cursor : undefined;
  } while (cursor);

  var messages = [];

  for (var i = 0; i < blobs.length; i++) {
    var blob = blobs[i];

    try {
      var message = await readBlobJson(blob.pathname);
      if (message && typeof message === "object") {
        message.pathname = blob.pathname;
        messages.push(message);
      }
    } catch (e) {
      // Ignore malformed or already-deleted objects.
    }
  }

  messages.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return messages;
}

function requireAdmin(req, res) {
  var session = getCookie(req, COOKIE_NAME);

  if (!verifySession(session)) {
    json(res, 401, { message: "Unauthorized" });
    return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  try {
    var body;
    var action;
    var pathname;

    if (req.method === "GET") {
      if (!requireAdmin(req, res)) return;

      var messages = await listMessages();
      var unreadCount = messages.filter(function (item) {
        return !item.read && !item.archived;
      }).length;

      return json(res, 200, {
        messages: messages,
        unreadCount: unreadCount
      });
    }

    if (req.method === "POST") {
      body = requestBody(req);
      action = String(body.action || "");

      // Public contact form submission.
      if (!action) {
        if (clean(body.website, 200)) {
          return json(res, 200, { success: true });
        }

        var name = clean(body.name, MAX_NAME);
        var email = clean(body.email, MAX_EMAIL);
        var subject = clean(body.subject, MAX_SUBJECT);
        var messageText = clean(body.message, MAX_MESSAGE);

        if (!name || !validEmail(email) || !subject || !messageText) {
          return json(res, 400, {
            message: "Please provide a valid name, email, subject and message."
          });
        }

        var id = newId();
        var createdAt = new Date().toISOString();
        pathname = PREFIX + Date.now() + "-" + id + ".json";

        var record = {
          id: id,
          name: name,
          email: email,
          subject: subject,
          message: messageText,
          createdAt: createdAt,
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

      if (!requireAdmin(req, res)) return;

      pathname = String(body.pathname || "");

      if (!validPath(pathname)) {
        return json(res, 400, { message: "Invalid message." });
      }

      if (action === "delete") {
        await del(pathname);
        return json(res, 200, { success: true });
      }

      if (action === "update") {
        var current = await readBlobJson(pathname);

        if (!current) {
          return json(res, 404, { message: "Message not found." });
        }

        var next = {
          id: current.id,
          name: current.name,
          email: current.email,
          subject: current.subject,
          message: current.message,
          createdAt: current.createdAt,
          read: body.read === undefined ? Boolean(current.read) : Boolean(body.read),
          starred: body.starred === undefined ? Boolean(current.starred) : Boolean(body.starred),
          archived: body.archived === undefined ? Boolean(current.archived) : Boolean(body.archived)
        };

        await put(pathname, JSON.stringify(next), {
          access: "private",
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 0
        });

        next.pathname = pathname;

        return json(res, 200, {
          success: true,
          message: next
        });
      }

      return json(res, 400, { message: "Unknown message action." });
    }

    if (req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;

      var url = new URL(req.url, "http://localhost");
      pathname = url.searchParams.get("pathname") || "";

      if (!validPath(pathname)) {
        return json(res, 400, { message: "Invalid message." });
      }

      await del(pathname);
      return json(res, 200, { success: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return json(res, 405, { message: "Method not allowed" });
  } catch (error) {
    return json(res, 500, {
      message: error && error.message ? error.message : "Message service failed."
    });
  }
};
