const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

const REPO = process.env.GITHUB_REPO || "uditanshusiingh/uditanshu-portfolio";
const PATH = "data/portfolio.json";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function github(url, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(url, { ...options, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || `GitHub API error: ${r.status}`);
  return body;
}

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch {} }
  return {};
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      // Read from the same GitHub Contents API source used by publishing.
      // This avoids raw.githubusercontent.com cache/availability differences
      // between the admin panel and the public portfolio.
      const current = await github(
        `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main&t=${Date.now()}`
      );
      if (!current || current.encoding !== "base64" || !current.content) {
        throw new Error("Portfolio data is unavailable.");
      }
      const decoded = Buffer.from(current.content.replace(/\\n/g, ""), "base64").toString("utf8");
      const websiteData = JSON.parse(decoded);
      return send(res, 200, websiteData);
    }

    if (req.method !== "POST") return send(res, 405, { message: "Method not allowed" });

    const session = getCookie(req, COOKIE_NAME);
    if (!verifySession(session)) return send(res, 401, { message: "Unauthorized" });

    const data = bodyOf(req);
    if (!data || typeof data !== "object" || !data.profile || !Array.isArray(data.projects) || !Array.isArray(data.skills) || !Array.isArray(data.experience) || !Array.isArray(data.education) || !Array.isArray(data.certifications)) {
      return send(res, 400, { message: "Invalid portfolio data." });
    }

    let saved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await github(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main&t=${Date.now()}`);
      try {
        await github(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Update portfolio content from admin",
            content: Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64"),
            sha: current.sha,
            branch: "main"
          })
        });
        saved = true;
        break;
      } catch (error) {
        if (!/does not match|sha|409|conflict/i.test(String(error.message || "")) || attempt === 2) {
          throw error;
        }
      }
    }

    if (!saved) throw new Error("Portfolio data could not be synchronized.");
    return send(res, 200, { success: true, data });
  } catch (error) {
    return send(res, 500, { message: error.message || "Portfolio sync failed." });
  }
};