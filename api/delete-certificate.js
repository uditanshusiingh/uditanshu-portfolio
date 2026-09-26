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

function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  try {
    const token = getCookie(req, COOKIE_NAME);
    if (!verifySession(token)) return json(res, 401, { message: "Unauthorized" });

    const { url, title } = getBody(req);
    if (!url || !title) {
      return json(res, 400, { message: "Certificate URL and title are required." });
    }

    const cleanUrl = String(url).trim();
    const repo = process.env.GITHUB_REPO || "uditanshusiingh/uditanshu-portfolio";
    const repoPath = cleanUrl.replace(/^\/+/, "");

    if (!repoPath.startsWith("assets/certificates/") || repoPath.includes("..")) {
      return json(res, 400, { message: "Invalid certificate path." });
    }

    const currentIndex = await githubRequest(
      `https://api.github.com/repos/${repo}/contents/index.html?ref=main`
    );
    const currentHtml = Buffer.from(currentIndex.content, "base64").toString("utf8");

    const href = cleanUrl.replace(/"/g, "&quot;");
    let start = -1;
    let end = -1;

    // Uploaded certificates have a stable admin marker.
    const marker = `<!-- ADMIN CERTIFICATE: ${title} -->`;
    const markerPos = currentHtml.indexOf(marker);

    if (markerPos !== -1) {
      start = currentHtml.lastIndexOf('            <div class="col-md-6">', markerPos);
      const nextMarker = currentHtml.indexOf("            <!-- ADMIN CERTIFICATE:", markerPos + marker.length);
      const sectionEnd = currentHtml.indexOf("            <!-- CERTIFICATIONS END -->", markerPos);
      end = nextMarker !== -1 && nextMarker < sectionEnd ? nextMarker : sectionEnd;
    }

    // Fallback also supports older/admin records without the marker.
    if (start === -1) {
      const hrefPos = currentHtml.indexOf(`href="${href}"`);
      if (hrefPos !== -1) {
        start = currentHtml.lastIndexOf('            <div class="col-md-6">', hrefPos);
        const nextCard = currentHtml.indexOf('            <div class="col-md-6">', hrefPos + 1);
        const sectionEnd = currentHtml.indexOf("            <!-- CERTIFICATIONS END -->", hrefPos);
        end = nextCard !== -1 && nextCard < sectionEnd ? nextCard : sectionEnd;
      }
    }

    if (start === -1 || end === -1 || end <= start) {
      return json(res, 404, { message: "Certificate card could not be found in the portfolio." });
    }

    const updatedHtml = currentHtml.slice(0, start) + currentHtml.slice(end);

    // Use the Contents API for both files so deletion works reliably on Vercel.
    await githubRequest(
      `https://api.github.com/repos/${repo}/contents/index.html`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete certification: ${title}`,
          content: Buffer.from(updatedHtml, "utf8").toString("base64"),
          sha: currentIndex.sha,
          branch: "main"
        })
      }
    );

    const certificateFile = await githubRequest(
      `https://api.github.com/repos/${repo}/contents/${repoPath}?ref=main`
    );

    await githubRequest(
      `https://api.github.com/repos/${repo}/contents/${repoPath}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete certificate file: ${title}`,
          sha: certificateFile.sha,
          branch: "main"
        })
      }
    );

    return json(res, 200, { success: true });
  } catch (error) {
    return json(res, 500, { message: error.message || "Certificate deletion failed." });
  }
};
