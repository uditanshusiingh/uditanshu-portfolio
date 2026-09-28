const KEY = "uditanshu-portfolio-admin-data-v1";

let data = null;
let editType = null;
let editId = null;
let modal = null;
let confirmModal = null;
let confirmResolve = null;

const fallback = {
  profile: { name:"Uditanshu Kumar", role:"Web Developer", roles:["Web Developer"], location:"Sasaram, Bihar", email:"uditsingh9939@gmail.com", phone:"+91 91429 38826", bio:"Computer Science undergraduate and frontend-focused web developer.", aboutLead:"", aboutMuted:"", semester:"7th", dsaCount:"5+", certCount:"9+", screenSizes:"3", degree:"B.Tech CSE — Haridwar University", focus:"Frontend + MERN fundamentals", languages:"English · Hindi · Bhojpuri", github:"https://github.com/uditanshusiingh", linkedin:"https://www.linkedin.com/in/uditanshusiingh/", resume:"assets/Uditanshu_Kumar_Resume.docx" },
  projects: [], skills: [], experience: [], education: [], certifications: []
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

function showToast(message, error = false) {
  let toast = document.getElementById("adminToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminToast";
    toast.className = "admin-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(window.__adminToastTimer);
  window.__adminToastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function confirmAction(message, title = "uditanshu-portfolio.vercel.app") {
  return new Promise(resolve => {
    confirmResolve = resolve;
    const titleEl = document.getElementById("confirmModalTitle");
    const messageEl = document.getElementById("confirmModalMessage");
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmModal) confirmModal.show();
    else resolve(false);
  });
}

function finishConfirm(value) {
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(value);
  }
  if (confirmModal) confirmModal.hide();
}

function cacheData() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

async function fetchWebsiteData() {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("/api/portfolio-data?t=" + Date.now() + "-" + attempt, {
        credentials:"same-origin",
        cache:"no-store",
        headers:{ "Cache-Control":"no-cache", "Pragma":"no-cache" }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not load website data.");

  // Support both the current raw API response and wrapped { data } responses.
  const websiteData = result?.data && typeof result.data === "object"
    ? result.data
    : result;

  if (
    !websiteData?.profile ||
    !Array.isArray(websiteData.projects) ||
    !Array.isArray(websiteData.skills) ||
    !Array.isArray(websiteData.experience) ||
    !Array.isArray(websiteData.education) ||
    !Array.isArray(websiteData.certifications)
  ) {
    throw new Error("Website data format is invalid.");
  }

      return websiteData;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError || new Error("Could not load website data.");
}

async function publish(nextData) {
  const response = await fetch("/api/portfolio-data", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    credentials:"same-origin",
    body:JSON.stringify(nextData)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Could not publish changes.");
  data = result.data || nextData;
  cacheData();
  document.getElementById("saveStatus").textContent = "Website synced";
  setTimeout(() => document.getElementById("saveStatus").textContent = "Website synced", 1600);
}

async function saveData(nextData, successMessage = "Changes published successfully.") {
  const previous = data;
  try {
    await publish(nextData);
    renderAll();
    showToast(successMessage);
  } catch (error) {
    data = previous;
    renderAll();
    showToast(error.message || "Could not publish changes.", true);
    throw error;
  }
}

function show(section) {
  document.querySelectorAll(".content-section").forEach(x => x.classList.toggle("active", x.id === section));
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.toggle("active", x.dataset.section === section));
  document.getElementById("pageTitle").textContent = section[0].toUpperCase() + section.slice(1);
  renderAll();
  document.querySelector(".sidebar")?.classList.remove("open");
}

function renderAll() {
  if (!data) return;
  renderStats();
  renderProfile();
  ["projects","skills","experience","education","certifications"].forEach(renderCollection);
}

function renderStats() {
  const items = [
    ["bi-folder2-open","Projects",(data.projects || []).length,"projects"],
    ["bi-code-slash","Skills",(data.skills || []).length,"skills"],
    ["bi-briefcase","Experience",(data.experience || []).length,"experience"],
    ["bi-patch-check","Certifications",(data.certifications || []).length,"certifications"]
  ];
  document.getElementById("statsGrid").innerHTML = items.map(x =>
    `<button type="button" class="stat-card" data-open="${x[3]}"><i class="bi ${x[0]}"></i><b>${x[2]}</b><span>${x[1]}</span></button>`
  ).join("");
}

function renderProfile() {
  const form = document.getElementById("profileForm");
  if (!form || !data.profile) return;
  Object.entries(data.profile).forEach(([key,value]) => {
    const field = form.elements[key];
    if (!field || field.type === "file") return;
    field.value = Array.isArray(value) ? value.join(", ") : (value ?? "");
  });
  const resumeName = document.getElementById("resumeFileName");
  if (resumeName) {
    const resumePath = data.profile.resume || "";
    resumeName.textContent = resumePath
      ? "Current resume: " + resumePath.split("/").pop()
      : "No resume uploaded";
  }
  const profileImageName = document.getElementById("profileImageFileName");
  if (profileImageName) {
    const imagePath = data.profile.image || "";
    profileImageName.textContent = imagePath
      ? "Current profile picture: " + imagePath.split("/").pop()
      : "No profile picture uploaded";
  }
}

function renderCollection(type) {
  const el = document.getElementById(type + "List");
  const arr = [...(data[type] || [])].sort((a,b) => {
    if (type !== "projects") return 0;
    const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 999999;
    const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 999999;
    return pa - pb || Number(a.id || 0) - Number(b.id || 0);
  });
  if (!arr.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><h3>No items yet</h3><p>Use the button above to add your first item.</p></div>';
    return;
  }
  const labels = {
    projects:["title","category"],
    skills:["name","category"],
    experience:["role","company"],
    education:["degree","institution"],
    certifications:["title","issuer"]
  };
  el.innerHTML = arr.map(item =>
    `<div class="data-row"><div><b>${esc(item[labels[type][0]])}</b><small>${esc(item[labels[type][1]] || "")}</small></div>
      <div class="row-actions"><button type="button" onclick="editItem('${type}',${item.id})"><i class="bi bi-pencil"></i></button>
      <button type="button" class="delete" onclick="deleteItem('${type}',${item.id})"><i class="bi bi-trash"></i></button></div>
    </div>`
  ).join("");
}

function fields(type, item = {}) {
  if (type === "certifications") {
    return `<div class="editor-grid certification-editor">
      <div><label>Certificate title</label><input name="title" type="text" value="${esc(item.title || "")}" required></div>
      <div><label>Issuer / Platform</label><input name="issuer" type="text" value="${esc(item.issuer || "")}" required></div>
      <div><label>Date <small>(calendar)</small></label><input name="date" type="date" value="${/^\d{4}-\d{2}-\d{2}$/.test(item.date || "") ? esc(item.date) : ""}" ${item.id ? "" : "required"}></div>
      <div><label>Icon class</label><input name="icon" type="text" value="${esc(item.icon || "bi-file-earmark-pdf")}"></div>
      <div class="full"><label>Certificate file ${item.id ? "(leave empty to keep current file)" : ""}</label>
        <div id="certificateDropzone" class="certificate-dropzone" tabindex="0">
          <input id="certificateFile" name="certificate" type="file" accept="application/pdf,.pdf" hidden>
          <i class="bi bi-cloud-arrow-up"></i><strong>Drag & drop certificate here</strong>
          <span>or click to browse · PDF only · max 10 MB</span>
          <small id="certificateFileName">${item.url ? "Current certificate: " + esc(item.url.split("/").pop()) : "No file selected"}</small>
        </div>
      </div>
    </div>`;
  }

  const specs = {
    projects:[
      ["title","Title","text"],["priority","Priority order","number"],["category","Category","text"],["description","Description","textarea"],
      ["tech","Technologies (comma separated)","text"],["live","Live URL","url"],["github","GitHub URL","url"],
      ["icon","Bootstrap icon class","text"],["featured","Featured","checkbox"]
    ],
    skills:[
      ["name","Skill name","text"],["category","Category / group","text"],
      ["description","Category card description","textarea"],["icon","Bootstrap icon class","text"]
    ],
    experience:[
      ["role","Role","text"],["company","Company / organization","text"],["duration","Duration / label","text"],
      ["description","Description","textarea"],["bullets","Bullet points (use | between points)","textarea"],
      ["tech","Technologies (comma separated)","text"],["icon","Bootstrap icon class","text"]
    ],
    education:[
      ["degree","Degree / qualification","text"],["institution","Institution","text"],["duration","Duration / label","text"],
      ["description","Description","textarea"],["tags","Tags (use | between tags)","text"],["icon","Bootstrap icon class","text"]
    ]
  };

  return '<div class="editor-grid">' + (specs[type] || []).map(([name,label,inputType]) => {
    if (inputType === "textarea") return `<div class="full"><label>${label}</label><textarea name="${name}" rows="4">${esc(item[name] || "")}</textarea></div>`;
    if (inputType === "checkbox") return `<div class="full form-check"><input class="form-check-input" name="${name}" type="checkbox" ${item[name] ? "checked" : ""}><label class="d-inline ms-2">${label}</label></div>`;
    return `<div><label>${label}</label><input name="${name}" type="${inputType}" value="${esc(item[name] ?? "")}"></div>`;
  }).join("") + "</div>";
}

function editItem(type, id = null) {
  editType = type;
  editId = id;
  const item = id ? (data[type] || []).find(x => x.id === id) : {};
  document.getElementById("modalTitle").textContent = (id ? "Edit " : "Add ") + type.replace(/s$/, "");
  document.getElementById("modalBody").innerHTML = fields(type, item);
  modal.show();
}

async function deleteItem(type, id) {
  const confirmed = await confirmAction(
    type === "certifications"
      ? "Delete this certificate from the admin panel and public website?"
      : "Delete this item from the admin panel and public website?"
  );
  if (!confirmed) return;
  const item = (data[type] || []).find(x => x.id === id);
  if (!item) return;

  const previous = structuredClone(data);
  try {
    if (type === "certifications" && item.url) {
      const response = await fetch("/api/delete-certificate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        credentials:"same-origin",
        body:JSON.stringify({ url:item.url, title:item.title })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Certificate deletion failed.");
    }
    const next = structuredClone(data);
    next[type] = next[type].filter(x => x.id !== id);
    await publish(next);
    renderAll();
    showToast(type === "certifications" ? "Certificate deleted from the website." : "Item deleted from the website.");
  } catch (error) {
    data = previous;
    renderAll();
    showToast(error.message || "Deletion failed.", true);
  }
}

function collectForm(form) {
  const result = {};
  new FormData(form).forEach((value,key) => {
    if (key !== "certificate") result[key] = value;
  });
  if (form.elements.featured) result.featured = form.elements.featured.checked;
  return result;
}

document.addEventListener("DOMContentLoaded", async () => {
  modal = new bootstrap.Modal("#editorModal");
  confirmModal = new bootstrap.Modal("#confirmModal", { backdrop:"static", keyboard:false });

  document.getElementById("confirmModalOk")?.addEventListener("click", () => finishConfirm(true));
  document.getElementById("confirmModalCancel")?.addEventListener("click", () => finishConfirm(false));
  document.getElementById("confirmModal")?.addEventListener("hidden.bs.modal", () => {
    if (confirmResolve) {
      const resolve = confirmResolve;
      confirmResolve = null;
      resolve(false);
    }
  });

  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const sidebarThemeBtn = document.getElementById("sidebarThemeBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const profileForm = document.getElementById("profileForm");
  const editorForm = document.getElementById("editorForm");

  const showApp = () => { loginView.classList.add("d-none"); appView.classList.remove("d-none"); renderAll(); };
  const showLogin = () => { appView.classList.add("d-none"); loginView.classList.remove("d-none"); };

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials:"same-origin", cache:"no-store" });
      if (!response.ok) { showLogin(); return false; }
      try { data = await fetchWebsiteData(); cacheData(); }
      catch {
        const stored = localStorage.getItem(KEY);
        data = stored ? JSON.parse(stored) : structuredClone(fallback);
        showToast("Using cached admin data. Website sync is unavailable.", true);
      }
      showApp();
      return true;
    } catch {
      showLogin();
      loginError.textContent = "Cannot reach authentication server. Please try again.";
      return false;
    }
  };

  document.querySelectorAll(".nav-btn").forEach(btn => btn.onclick = () => show(btn.dataset.section));
  document.addEventListener("click", e => {
    const target = e.target.closest("[data-open]");
    if (target) show(target.dataset.open);
  });

  loginForm.onsubmit = async e => {
    e.preventDefault();
    loginError.textContent = "";
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true; button.innerHTML = "Signing in...";
    try {
      const response = await fetch("/api/auth/login", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body:JSON.stringify({email:loginEmail.value,password:loginPassword.value})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Sign in failed.");
      loginPassword.value = "";
      await checkAuth();
    } catch (error) {
      loginError.textContent = error.message || "Sign in failed.";
    } finally {
      button.disabled = false;
      button.innerHTML = 'Sign in <i class="bi bi-arrow-right"></i>';
    }
  };

  logoutBtn.onclick = async () => {
    try { await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"}); }
    finally { location.reload(); }
  };

  const savedTheme = localStorage.getItem("uditanshu-portfolio-theme");
  if (savedTheme === "light") document.body.classList.add("light-mode");
  const updateThemeIcon = () => {
    const light = document.body.classList.contains("light-mode");
    const icon = sidebarThemeBtn?.querySelector("i");
    if (icon) icon.className = light ? "bi bi-sun" : "bi bi-moon";
  };
  updateThemeIcon();
  sidebarThemeBtn?.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    localStorage.setItem("uditanshu-portfolio-theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    updateThemeIcon();
  });
  mobileMenu?.addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));


  async function uploadProfileImage(file) {
    if (!file) return;
    const allowed = /\.(png|jpe?g|webp)$/i.test(String(file.name || ""));
    if (!allowed) {
      showToast("Profile picture must be JPG, PNG, or WEBP.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Profile picture must be 5 MB or smaller.", true);
      return;
    }

    const dropzone = document.getElementById("profileImageDropzone");
    const label = document.getElementById("profileImageFileName");
    const formData = new FormData();
    formData.append("profileImage", file);

    dropzone?.classList.add("uploading");
    if (label) label.textContent = "Uploading " + file.name + "...";

    try {
      const response = await fetch("/api/upload-profile-image", {
        method:"POST",
        credentials:"same-origin",
        body:formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Profile picture upload failed.");

      data = result.data || await fetchWebsiteData();
      cacheData();
      renderAll();
      document.getElementById("saveStatus").textContent = "Website synced";
      if (label) label.textContent = "Current profile picture: " + file.name;
      showToast("Profile picture uploaded and published successfully.");
    } catch (error) {
      if (label) label.textContent = data?.profile?.image
        ? "Current profile picture: " + data.profile.image.split("/").pop()
        : "No profile picture uploaded";
      showToast(error.message || "Profile picture upload failed.", true);
    } finally {
      dropzone?.classList.remove("uploading");
    }
  }

  document.addEventListener("click", e => {
    const zone = e.target.closest("#profileImageDropzone");
    if (zone && e.target.id !== "profileImageFile") document.getElementById("profileImageFile")?.click();
  });

  document.addEventListener("keydown", e => {
    if (e.target.id === "profileImageDropzone" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      document.getElementById("profileImageFile")?.click();
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "profileImageFile") {
      const file = e.target.files?.[0];
      if (file) uploadProfileImage(file);
    }
  });

  document.addEventListener("dragover", e => {
    const zone = e.target.closest("#profileImageDropzone");
    if (zone) {
      e.preventDefault();
      zone.classList.add("dragover");
    }
  });

  document.addEventListener("dragleave", e => {
    const zone = e.target.closest("#profileImageDropzone");
    if (zone) zone.classList.remove("dragover");
  });

  document.addEventListener("drop", e => {
    const zone = e.target.closest("#profileImageDropzone");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) uploadProfileImage(file);
  });

  async function uploadResume(file) {
    if (!file) return;
    const name = String(file.name || "");
    const allowed = /\.(pdf|doc|docx)$/i.test(name);
    if (!allowed) {
      showToast("Resume must be a PDF, DOC, or DOCX file.", true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("Resume must be 10 MB or smaller.", true);
      return;
    }

    const dropzone = document.getElementById("resumeDropzone");
    const label = document.getElementById("resumeFileName");
    const formData = new FormData();
    formData.append("resume", file);

    dropzone?.classList.add("uploading");
    if (label) label.textContent = "Uploading " + file.name + "...";

    try {
      const response = await fetch("/api/upload-resume", {
        method:"POST",
        credentials:"same-origin",
        body:formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Resume upload failed.");

      data = result.data || await fetchWebsiteData();
      cacheData();
      renderAll();
      document.getElementById("saveStatus").textContent = "Website synced";
      if (label) label.textContent = "Current resume: " + file.name;
      showToast("Resume uploaded and published successfully.");
    } catch (error) {
      if (label) label.textContent = "No file selected";
      showToast(error.message || "Resume upload failed.", true);
    } finally {
      dropzone?.classList.remove("uploading");
    }
  }

  document.addEventListener("click", e => {
    const zone = e.target.closest("#resumeDropzone");
    if (zone && e.target.id !== "resumeFile") document.getElementById("resumeFile")?.click();
  });

  document.addEventListener("keydown", e => {
    if (e.target.id === "resumeDropzone" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      document.getElementById("resumeFile")?.click();
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "resumeFile") {
      const file = e.target.files?.[0];
      if (file) uploadResume(file);
    }
  });

  document.addEventListener("dragover", e => {
    const zone = e.target.closest("#resumeDropzone");
    if (zone) {
      e.preventDefault();
      zone.classList.add("dragover");
    }
  });

  document.addEventListener("dragleave", e => {
    const zone = e.target.closest("#resumeDropzone");
    if (zone) zone.classList.remove("dragover");
  });

  document.addEventListener("drop", e => {
    const zone = e.target.closest("#resumeDropzone");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    uploadResume(file);
  });

  profileForm.onsubmit = async e => {
    e.preventDefault();
    const next = structuredClone(data);
    const formData = new FormData(e.target);
    const profile = {};
    formData.forEach((value,key) => {
      // File inputs are handled by their own upload endpoint.
      if (key === "resumeFile" || value instanceof File) return;
      profile[key] = key === "roles" ? String(value).split(",").map(v => v.trim()).filter(Boolean) : value;
    });
    next.profile = { ...next.profile, ...profile };
    try { await saveData(next, "Profile changes published to the website."); } catch {}
  };

  editorForm.onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const values = collectForm(form);
    const existing = editId ? (data[editType] || []).find(x => x.id === editId) : null;
    values.id = editId || Date.now();

    if (editType === "certifications" && !editId) {
      const file = form.elements.certificate?.files?.[0];
      if (!file) { showToast("Please select a certificate PDF.", true); return; }
      const button = form.querySelector('button[type="submit"]');
      const original = button.innerHTML;
      button.disabled = true; button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Uploading...';
      try {
        const response = await fetch("/api/upload-certificate", { method:"POST", credentials:"same-origin", body:new FormData(form) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Certificate upload failed.");
        // The upload API now registers the certificate in portfolio.json
        // as part of the upload. Refresh from the server so the admin list
        // always reflects the exact published data.
        data = result.data || await fetchWebsiteData();
        cacheData();
        document.getElementById("saveStatus").textContent = "Website synced";
        modal.hide();
        renderAll();
        showToast("Certificate uploaded and added to the admin panel.");
      } catch (error) {
        showToast(error.message || "Certificate upload failed.", true);
      } finally {
        button.disabled = false; button.innerHTML = original;
      }
      return;
    }

    if (editType === "certifications" && editId && !values.date && existing?.date) values.date = existing.date;
    if (editType === "certifications" && editId) values.url = existing?.url || "";
    const next = structuredClone(data);
    next[editType] = editId
      ? next[editType].map(x => x.id === editId ? { ...x, ...values } : x)
      : [...next[editType], values];

    try {
      await saveData(next, (editId ? "Changes published to the website." : "Item published to the website."));
      modal.hide();
    } catch {}
  };

  document.getElementById("addProject").onclick = () => editItem("projects");
  document.getElementById("addSkill").onclick = () => editItem("skills");
  document.getElementById("addExperience").onclick = () => editItem("experience");
  document.getElementById("addEducation").onclick = () => editItem("education");
  document.getElementById("addCertification").onclick = () => editItem("certifications");

  document.getElementById("exportData").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.download = "uditanshu-portfolio-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById("importData").onchange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported.profile || !Array.isArray(imported.projects) || !Array.isArray(imported.skills) || !Array.isArray(imported.experience) || !Array.isArray(imported.education) || !Array.isArray(imported.certifications)) throw new Error("Invalid portfolio backup.");
      await saveData(imported, "Backup imported and published to the website.");
    } catch (error) {
      showToast(error.message || "Invalid JSON backup.", true);
    } finally {
      e.target.value = "";
    }
  };

  document.getElementById("resetData").onclick = () => {
    showToast("Reset only clears this browser cache. Published website content is kept safe.", true);
    localStorage.removeItem(KEY);
  };

  document.addEventListener("click", e => {
    const zone = e.target.closest("#certificateDropzone");
    if (zone && e.target.id !== "certificateFile") document.getElementById("certificateFile")?.click();
  });
  document.addEventListener("keydown", e => {
    if (e.target.id === "certificateDropzone" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); document.getElementById("certificateFile")?.click();
    }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "certificateFile") {
      const file = e.target.files?.[0];
      if (file) document.getElementById("certificateFileName").textContent = file.name;
    }
  });
  document.addEventListener("dragover", e => {
    const zone = e.target.closest("#certificateDropzone");
    if (zone) { e.preventDefault(); zone.classList.add("dragover"); }
  });
  document.addEventListener("dragleave", e => {
    const zone = e.target.closest("#certificateDropzone");
    if (zone) zone.classList.remove("dragover");
  });
  document.addEventListener("drop", e => {
    const zone = e.target.closest("#certificateDropzone");
    if (!zone) return;
    e.preventDefault(); zone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const input = document.getElementById("certificateFile");
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      document.getElementById("certificateFileName").textContent = file.name;
    }
  });

  await checkAuth();
});

window.editItem = editItem;
window.deleteItem = deleteItem;