module.exports.config = { api: { bodyParser: false } };

const fs = require("fs");
const path = require("path");
const { formidable } = require("formidable");
const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

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
      allowEmptyFiles: false,
      filter: ({ mimetype }) => mimetype === "application/pdf"
    });

    const [fields, files] = await form.parse(req);
    const uploaded = getSingle(files.certificate);

    if (!uploaded) {
      return json(res, 400, { message: "Certificate PDF is required." });
    }

    const mime = String(uploaded.mimetype || "").toLowerCase();
    const originalName = String(uploaded.originalFilename || "certificate.pdf");
    if (mime !== "application/pdf" && !/\.pdf$/i.test(originalName)) {
      return json(res, 400, { message: "Only PDF certificate files are supported." });
    }

    const title = String(getSingle(fields.title) || "").trim();
    const issuer = String(getSingle(fields.issuer) || "").trim();
    const date = String(getSingle(fields.date) || "").trim();
    const icon = String(getSingle(fields.icon) || "bi-file-earmark-pdf").trim();

    if (!title || !issuer || !date) {
      return json(res, 400, { message: "Title, issuer and date are required." });
    }

    const stat = fs.statSync(uploaded.filepath);
    if (stat.size <= 0) {
      return json(res, 400, { message: "The selected PDF is empty." });
    }
    if (stat.size > MAX_FILE_SIZE) {
      return json(res, 400, { message: "Certificate PDF must be 10 MB or smaller." });
    }

    const base = cleanName(originalName.replace(/\.pdf$/i, "")) || "certificate";
    const filename = `${Date.now()}-${base}.pdf`;
    const repoPath = `assets/certificates/${filename}`;
    const publicPath = `/${repoPath}`;
    const buffer = fs.readFileSync(uploaded.filepath);

    const created = await githubRequest(`https://api.github.com/repos/${repo}/contents/${repoPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add certificate file: ${title}`,
        content: buffer.toString("base64"),
        branch: "main"
      })
    });

    if (!created?.content?.path) {
      throw new Error("GitHub did not confirm the certificate file upload.");
    }

    // Keep the admin panel and public portfolio in sync from the same upload.
    // The PDF alone is not enough because the public site reads certificates
    // from data/portfolio.json.
    const dataPath = "data/portfolio.json";
    const certification = {
      id: Date.now(),
      title,
      issuer,
      date,
      url: publicPath,
      icon
    };
    let portfolio;

    // Re-read portfolio.json when GitHub reports a stale blob SHA.
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentData = await githubRequest(
        `https://api.github.com/repos/${repo}/contents/${dataPath}?ref=main&t=${Date.now()}`
      );
      portfolio = JSON.parse(
        Buffer.from(currentData.content, "base64").toString("utf8")
      );

      if (!portfolio || typeof portfolio !== "object" || !Array.isArray(portfolio.certifications)) {
        throw new Error("Portfolio certificate data is invalid.");
      }

      portfolio.certifications.push(certification);

      try {
        await githubRequest(
          `https://api.github.com/repos/${repo}/contents/${dataPath}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Register certificate: ${title}`,
              content: Buffer.from(
                JSON.stringify(portfolio, null, 2) + "\n",
                "utf8"
              ).toString("base64"),
              sha: currentData.sha,
              branch: "main"
            })
          }
        );
        break;
      } catch (error) {
        if (!/does not match|sha|409|conflict/i.test(String(error.message || "")) || attempt === 2) {
          throw error;
        }
      }
    }

    return json(res, 200, {
      success: true,
      certification,
      data: portfolio
    });
  } catch (error) {
    const message = String(error?.message || "Certificate upload failed.");
    if (/maxFileSize|larger than the maximum|too large/i.test(message)) {
      return json(res, 400, { message: "Certificate PDF must be 10 MB or smaller." });
    }
    return json(res, 500, { message });
  }
};
