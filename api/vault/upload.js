const { handleUpload } = require("@vercel/blob/client");
const { COOKIE_NAME, getCookie, verifySession } = require("../auth/_session");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  const session = getCookie(req, COOKIE_NAME);
  if (!verifySession(session)) return json(res, 401, { message: "Unauthorized" });

  try {
    const body = req.body || {};
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!String(pathname || "").startsWith("vault/files/")) {
          throw new Error("Invalid vault upload path.");
        }
        return {
          addRandomSuffix: false,
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024,
          allowedContentTypes: ["*/*"],
          validUntil: Date.now() + 15 * 60 * 1000
        };
      },
      onUploadCompleted: async () => {}
    });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 400, { message: error?.message || "Vault upload authorization failed." });
  }
};
