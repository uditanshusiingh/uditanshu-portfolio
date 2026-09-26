module.exports.config = { api: { bodyParser: false } };

const fs = require("fs");
const { formidable } = require("formidable");
const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx)$/i;

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

function cleanName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
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
    const session = getCookie(req, COOKIE_NAME);
    if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

    const repo = process.env.GITHUB_REPO || "uditanshusiingh/uditanshu-portfolio";
    const form = formidable({
      multiples: false,
      maxFileSize: MAX_FILE_SIZE,
      keepExtensions: true,
      allowEmptyFiles: false
    });

    const [fields, files] = await form.parse(req);
    const uploaded = getSingle(files.resume);
    if (!uploaded) return json(res, 400, { message: "Resume file is required." });

    const originalName = String(uploaded.originalFilename || "resume.docx");
    if (!ALLOWED_EXTENSIONS.test(originalName)) {
      return json(res, 400, { message: "Resume must be a PDF, DOC, or DOCX file." });
    }

    const stat = fs.statSync(uploaded.filepath);
    if (stat.size <= 0) return json(res, 400, { message: "The selected resume file is empty." });
    if (stat.size > MAX_FILE_SIZE) return json(res, 400, { message: "Resume must be 10 MB or smaller." });

    const extension = (originalName.match(/\.[^.]+$/) || [".docx"])[0].toLowerCase();
    const base = cleanName(originalName.replace(/\.[^.]+$/, "")) || "resume";
    const filename = `${Date.now()}-${base}${extension}`;
    const repoPath = `assets/resumes/${filename}`;
    const publicPath = `/${repoPath}`;
    const buffer = fs.readFileSync(uploaded.filepath);

    const created = await githubRequest(`https://api.github.com/repos/${repo}/contents/${repoPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Upload resume from admin",
        content: buffer.toString("base64"),
        branch: "main"
      })
    });

    if (!created?.content?.path) throw new Error("GitHub did not confirm the resume upload.");

    const dataPath = "data/portfolio.json";
    const currentData = await githubRequest(
      `https://api.github.com/repos/${repo}/contents/${dataPath}?ref=main`
    );
    const portfolio = JSON.parse(Buffer.from(currentData.content, "base64").toString("utf8"));

    if (!portfolio || typeof portfolio !== "object" || !portfolio.profile) {
      throw new Error("Portfolio profile data is invalid.");
    }

    portfolio.profile.resume = publicPath;

    await githubRequest(`https://api.github.com/repos/${repo}/contents/${dataPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Register resume in portfolio data",
        content: Buffer.from(JSON.stringify(portfolio, null, 2) + "\n", "utf8").toString("base64"),
        sha: currentData.sha,
        branch: "main"
      })
    });

    return json(res, 200, { success: true, resume: publicPath, data: portfolio });
  } catch (error) {
    const message = String(error?.message || "Resume upload failed.");
    if (/maxFileSize|larger than the maximum|too large/i.test(message)) {
      return json(res, 400, { message: "Resume must be 10 MB or smaller." });
    }
    return json(res, 500, { message });
  }
};
