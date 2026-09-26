const fs = require("fs");
const path = require("path");
const { formidable } = require("formidable");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf"]);

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
  if (!response.ok) {
    throw new Error(data.message || `GitHub API error: ${response.status}`);
  }
  return data;
}

function cleanName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function certificateCard({ title, issuer, date, url, icon = "bi-file-earmark-pdf" }) {
  return `
            <!-- ADMIN CERTIFICATE: ${escapeHtml(title)} -->
            <div class="col-md-6">
              <div class="certificate-item">
                <div class="certificate-info">
                  <div class="certificate-icon">
                    <i class="bi ${icon}"></i>
                  </div>
                  <div>
                    <h5>${escapeHtml(title)}</h5>
                    <p>${escapeHtml(issuer)}</p>
                    <small>${escapeHtml(date)}</small>
                  </div>
                </div>
                <a href="${escapeHtml(url)}" target="_blank" class="certificate-btn">
                  View Certificate
                  <i class="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
            </div>

`;
}

function getSingle(value) {
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  try {
    const token = getCookie(req, COOKIE_NAME);
    if (!verifySession(token)) {
      return json(res, 401, { message: "Unauthorized" });
    }

    const repo = process.env.GITHUB_REPO || "uditanshusiingh/uditanshu-portfolio";
    const form = formidable({
      multiples: false,
      maxFileSize: MAX_FILE_SIZE,
      keepExtensions: true,
      allowEmptyFiles: false
    });

    const [fields, files] = await form.parse(req);
    const uploaded = getSingle(files.certificate);

    if (!uploaded) return json(res, 400, { message: "Certificate file is required." });

    if (!ALLOWED_TYPES.has(uploaded.mimetype)) {
      return json(res, 400, { message: "Only PDF certificate files are supported." });
    }

    const title = String(getSingle(fields.title) || "").trim();
    const issuer = String(getSingle(fields.issuer) || "").trim();
    const date = String(getSingle(fields.date) || "").trim();

    if (!title || !issuer || !date) {
      return json(res, 400, { message: "Title, issuer and date are required." });
    }

    const original = path.basename(uploaded.originalFilename || "certificate.pdf");
    const base = cleanName(original.replace(/.pdf$/i, "")) || "certificate";
    const filename = `${Date.now()}-${base}.pdf`;
    const repoPath = `assets/certificates/${filename}`;
    const publicPath = `/${repoPath}`;

    const buffer = fs.readFileSync(uploaded.filepath);
    const blob = await githubRequest(`https://api.github.com/repos/${repo}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: buffer.toString("base64"),
        encoding: "base64"
      })
    });

    const ref = await githubRequest(`https://api.github.com/repos/${repo}/git/ref/heads/main`);
    const baseCommit = await githubRequest(`https://api.github.com/repos/${repo}/git/commits/${ref.object.sha}`);
    const tree = await githubRequest(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [{
          path: repoPath,
          mode: "100644",
          type: "blob",
          sha: blob.sha
        }]
      })
    });

    const currentIndex = await githubRequest(`https://api.github.com/repos/${repo}/contents/index.html?ref=main`);
    const currentHtml = Buffer.from(currentIndex.content, "base64").toString("utf8");

    const marker = '        <div class="modal-footer">';
    const insertAt = currentHtml.lastIndexOf(marker);
    if (insertAt === -1) throw new Error("Certification section could not be located in index.html.");

    const card = certificateCard({
      title,
      issuer,
      date,
      url: publicPath
    });

    const updatedHtml = currentHtml.slice(0, insertAt) + card + currentHtml.slice(insertAt);

    const indexBlob = await githubRequest(`https://api.github.com/repos/${repo}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: Buffer.from(updatedHtml, "utf8").toString("base64"),
        encoding: "base64"
      })
    });

    const finalTree = await githubRequest(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [
          { path: repoPath, mode: "100644", type: "blob", sha: blob.sha },
          { path: "index.html", mode: "100644", type: "blob", sha: indexBlob.sha }
        ]
      })
    });

    const commit = await githubRequest(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add certification: ${title}`,
        tree: finalTree.sha,
        parents: [baseCommit.sha]
      })
    });

    await githubRequest(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false })
    });

    return json(res, 200, {
      success: true,
      certification: {
        id: Date.now(),
        title,
        issuer,
        date,
        url: publicPath
      }
    });
  } catch (error) {
    return json(res, 500, {
      message: error.message || "Certificate upload failed."
    });
  }
};
