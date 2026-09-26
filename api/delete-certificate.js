module.exports.config = { api: { bodyParser: false } };

const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured.");

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub API error: ${response.status}`);
  return data;
}

function esc(value) {
  return String(value || "").replace(/[.*+?^()|[\]\\]/g, "\\$&");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  try {
    const token = getCookie(req, COOKIE_NAME);
    if (!verifySession(token)) return json(res, 401, { message: "Unauthorized" });

    const { url, title } = req.body && typeof req.body === "object" ? req.body : {};
    if (!url || !title) return json(res, 400, { message: "Certificate URL and title are required." });

    const cleanUrl = String(url).trim();
    const repo = process.env.GITHUB_REPO || "uditanshusiingh/uditanshu-portfolio";
    const repoPath = cleanUrl.replace(/^\/+/, "");

    if (!repoPath.startsWith("assets/certificates/") || repoPath.includes("..")) {
      return json(res, 400, { message: "Invalid certificate path." });
    }

    const ref = await githubRequest(`https://api.github.com/repos/${repo}/git/ref/heads/main`);
    const baseCommit = await githubRequest(`https://api.github.com/repos/${repo}/git/commits/${ref.object.sha}`);
    const currentIndex = await githubRequest(`https://api.github.com/repos/${repo}/contents/index.html?ref=main`);
    const currentHtml = Buffer.from(currentIndex.content, "base64").toString("utf8");

    const href = cleanUrl.replace(/"/g, "&quot;");
    let start = -1;
    let end = -1;

    const adminMarker = `<!-- ADMIN CERTIFICATE: ${title} -->`;
    const adminStart = currentHtml.indexOf(adminMarker);
    if (adminStart !== -1) {
      start = currentHtml.lastIndexOf("            <div class=\"col-md-6\">", adminStart);
      const nextAdmin = currentHtml.indexOf("            <!-- ADMIN CERTIFICATE:", adminStart + adminMarker.length);
      const sectionEnd = currentHtml.indexOf("            <!-- CERTIFICATIONS END -->", adminStart);
      end = nextAdmin !== -1 && nextAdmin < sectionEnd ? nextAdmin : sectionEnd;
    }

    if (start === -1) {
      const hrefPos = currentHtml.indexOf(`href="${href}"`);
      if (hrefPos !== -1) {
        start = currentHtml.lastIndexOf("            <div class=\"col-md-6\">", hrefPos);
        const nextCard = currentHtml.indexOf("            <div class=\"col-md-6\">", hrefPos + 1);
        const sectionEnd = currentHtml.indexOf("            <!-- CERTIFICATIONS END -->", hrefPos);
        end = nextCard !== -1 && nextCard < sectionEnd ? nextCard : sectionEnd;
      }
    }

    if (start === -1 || end === -1) {
      return json(res, 404, { message: "Certificate card could not be found in the portfolio." });
    }

    const updatedHtml = currentHtml.slice(0, start) + currentHtml.slice(end);

    const indexBlob = await githubRequest(`https://api.github.com/repos/${repo}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: Buffer.from(updatedHtml, "utf8").toString("base64"),
        encoding: "base64"
      })
    });

    const tree = await githubRequest(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [
          { path: "index.html", mode: "100644", type: "blob", sha: indexBlob.sha },
          { path: repoPath, mode: "100644", type: "blob", sha: null }
        ]
      })
    });

    const commit = await githubRequest(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Delete certification: ${title}`,
        tree: tree.sha,
        parents: [baseCommit.sha]
      })
    });

    await githubRequest(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false })
    });

    return json(res, 200, { success: true });
  } catch (error) {
    return json(res, 500, { message: error.message || "Certificate deletion failed." });
  }
};
