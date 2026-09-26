module.exports.config = { api: { bodyParser: false } };

const fs = require("fs");
const { formidable } = require("formidable");
const { COOKIE_NAME, getCookie, verifySession } = require("./auth/_session");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

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

    const [, files] = await form.parse(req);
    const uploaded = getSingle(files.profileImage);
    if (!uploaded) return json(res, 400, { message: "Profile picture is required." });

    const originalName = String(uploaded.originalFilename || "profile-image.png");
    if (!ALLOWED_EXTENSIONS.test(originalName)) {
      return json(res, 400, { message: "Profile picture must be JPG, PNG, or WEBP." });
    }

    const stat = fs.statSync(uploaded.filepath);
    if (stat.size <= 0) return json(res, 400, { message: "The selected profile picture is empty." });
    if (stat.size > MAX_FILE_SIZE) return json(res, 400, { message: "Profile picture must be 5 MB or smaller." });

    const extension = (originalName.match(/\.[^.]+$/) || [".png"])[0].toLowerCase();
    const base = cleanName(originalName.replace(/\.[^.]+$/, "")) || "profile-image";
    const filename = `${Date.now()}-${base}${extension}`;
    const repoPath = `assets/profile/${filename}`;
    const publicPath = `/${repoPath}`;
    const buffer = fs.readFileSync(uploaded.filepath);

    await githubRequest(`https://api.github.com/repos/${repo}/contents/${repoPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Upload profile picture from admin",
        content: buffer.toString("base64"),
        branch: "main"
      })
    });

    const dataPath = "data/portfolio.json";
    let portfolio;
    let saved = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const currentData = await githubRequest(
        `https://api.github.com/repos/${repo}/contents/${dataPath}?ref=main&t=${Date.now()}`
      );
      portfolio = JSON.parse(Buffer.from(currentData.content, "base64").toString("utf8"));

      if (!portfolio || typeof portfolio !== "object" || !portfolio.profile) {
        throw new Error("Portfolio profile data is invalid.");
      }

      portfolio.profile.image = publicPath;

      try {
        await githubRequest(`https://api.github.com/repos/${repo}/contents/${dataPath}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Register profile picture in portfolio data",
            content: Buffer.from(JSON.stringify(portfolio, null, 2) + "\n", "utf8").toString("base64"),
            sha: currentData.sha,
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

    if (!saved) throw new Error("Profile picture could not be synchronized.");

    return json(res, 200, { success: true, image: publicPath, data: portfolio });
  } catch (error) {
    const message = String(error?.message || "Profile picture upload failed.");
    if (/maxFileSize|larger than the maximum|too large/i.test(message)) {
      return json(res, 400, { message: "Profile picture must be 5 MB or smaller." });
    }
    return json(res, 500, { message });
  }
};
