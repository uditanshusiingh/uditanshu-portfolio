document.addEventListener("DOMContentLoaded", () => {
  const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  const split = (value = "", separator = ",") =>
    String(value).split(separator).map(v => v.trim()).filter(Boolean);

  async function loadPortfolio() {
    try {
      const response = await fetch("/api/portfolio-data?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error("Portfolio data unavailable");
      const data = await response.json();
      renderPortfolio(data);
      return data;
    } catch (error) {
      console.warn("Using HTML fallback content:", error.message);
      return null;
    }
  }

  function renderPortfolio(data) {
    const p = data.profile || {};

    // Profile / hero
    const displayName = p.name || "Uditanshu Kumar";
    const nameTargets = document.querySelectorAll(".gradient-text");
    nameTargets.forEach(el => { el.textContent = displayName; });

    // Keep browser metadata and the profile image accessible name in sync too.
    document.title = displayName + " | " + (p.role || "Web Developer");
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = displayName + " — " + (p.role || "Web Developer") + " and Computer Science undergraduate portfolio.";
    const profileImage = document.querySelector(".profile-img");
    if (profileImage) profileImage.alt = displayName;
    const heroCopy = document.getElementById("heroCopy");
    if (heroCopy) heroCopy.textContent = p.bio || "";

    const typed = document.getElementById("typedRole");
    const roles = Array.isArray(p.roles) && p.roles.length ? p.roles : [p.role || "Web Developer"];
    let roleIndex = 0, charIndex = 0, deleting = false;

    function typeLoop() {
      if (!typed) return;
      const word = roles[roleIndex] || "Web Developer";
      charIndex = deleting ? Math.max(0, charIndex - 1) : Math.min(word.length, charIndex + 1);
      typed.textContent = word.slice(0, charIndex);
      let delay = deleting ? 55 : 90;
      if (!deleting && charIndex === word.length) { delay = 1300; deleting = true; }
      else if (deleting && charIndex === 0) { deleting = false; roleIndex = (roleIndex + 1) % roles.length; delay = 350; }
      setTimeout(typeLoop, delay);
    }
    typeLoop();

    const aboutLead = document.getElementById("aboutLead");
    const aboutMuted = document.getElementById("aboutMuted");
    if (aboutLead) aboutLead.textContent = p.aboutLead || p.bio || "";
    if (aboutMuted) aboutMuted.textContent = p.aboutMuted || "";

    const stats = document.getElementById("aboutStats");
    if (stats) {
      stats.innerHTML = [
        [p.semester || "7th", "Semester"],
        [p.dsaCount || "5+", "Core DSA topics"],
        [p.certCount || ((data.certifications || []).length + "+"), "Certifications"],
        [p.screenSizes || "3", "Screen sizes tested"]
      ].map(([value,label]) => `<div class="col-6 col-md-3"><div class="stat-box"><b>${esc(value)}</b><small>${esc(label)}</small></div></div>`).join("");
    }

    const quick = [
      ["quickLocation", "bi-geo-alt", p.locationDetail || p.location],
      ["quickDegree", "bi-mortarboard", p.degree],
      ["quickFocus", "bi-code-square", p.focus],
      ["quickLanguages", "bi-translate", p.languages]
    ];
    quick.forEach(([id, icon, value]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<i class="bi ${icon}"></i><span>${esc(value || "")}</span>`;
    });

    // Projects
    const projectGrid = document.getElementById("projectsGrid");
    if (projectGrid) {
      const projects = [...(data.projects || [])].sort((a,b) => {
        const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 999999;
        const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 999999;
        return pa - pb || Number(a.id || 0) - Number(b.id || 0);
      });
      projectGrid.innerHTML = projects.map(project => {
        const href = project.live || project.github || "#";
        const tags = split(project.tech).map(t => `<span>${esc(t)}</span>`).join("");
        return `<div class="col-lg-4 reveal">
          <a href="${esc(href)}" ${href !== "#" ? 'target="_blank" rel="noopener noreferrer"' : ""} class="project-card-link" aria-label="Open ${esc(project.title)} project">
            <article class="project-card h-100">
              <div class="project-icon"><i class="bi ${esc(project.icon || "bi-folder2-open")}"></i></div>
              <div class="project-body">
                <span class="project-label">${esc(project.category || "PROJECT")}</span>
                <h4>${esc(project.title)}</h4>
                <p>${esc(project.description)}</p>
                <div class="tags">${tags}</div>
              </div>
            </article>
          </a>
        </div>`;
      }).join("");
    }


    // Skills: visual showcase — no proficiency bars or ranking.
    const skillGrid = document.getElementById("skillsGrid");
    if (skillGrid) {
      const groups = [...new Set((data.skills || []).map(s => s.category || "Skills"))];
      const groupIcons = ["bi-window-stack", "bi-server", "bi-terminal"];
      const skillIcons = {
        "HTML5":"bi-filetype-html", "CSS3":"bi-filetype-css", "Bootstrap":"bi-bootstrap",
        "JavaScript":"bi-filetype-js", "Node.js":"bi-node-plus", "Express.js":"bi-lightning",
        "MongoDB":"bi-database", "REST / JSON":"bi-braces", "C++":"bi-filetype-cpp",
        "Python":"bi-filetype-py", "Java":"bi-cup-hot", "Git":"bi-git", "GitHub":"bi-github",
        "VS Code":"bi-code-square", "Postman":"bi-send", "STL":"bi-boxes"
      };
      skillGrid.innerHTML = groups.map((group, groupIndex) => {
        const items = (data.skills || []).filter(s => (s.category || "Skills") === group);
        const icon = items[0]?.icon || groupIcons[groupIndex] || "bi-tools";
        const description = items[0]?.description || "Technologies and tools used across my development workflow.";
        const number = String(groupIndex + 1).padStart(2, "0");
        const footer = groupIndex === 0 ? "Interface & user experience" : groupIndex === 1 ? "Services & data layer" : "Development workflow & problem solving";
        const chips = items.map(s =>
          '<span class="skill-chip"><i class="bi ' + esc(skillIcons[s.name] || s.icon || "bi-code-square") + '"></i>' + esc(s.name) + '</span>'
        ).join("");
        return '<div class="col-md-6 col-lg-4 reveal">' +
          '<article class="skill-showcase-card h-100">' +
            '<div class="skill-showcase-head">' +
              '<span class="skill-index">' + number + '</span>' +
              '<div class="skill-visual"><i class="bi ' + esc(icon) + '"></i></div>' +
              '<span class="skill-arrow"><i class="bi bi-arrow-up-right"></i></span>' +
            '</div>' +
            '<div class="skill-showcase-body">' +
              '<span class="project-label">' + esc(group) + '</span>' +
              '<h4>' + esc(group) + '</h4>' +
              '<p>' + esc(description) + '</p>' +
              '<div class="skill-chips">' + chips + '</div>' +
              '<div class="skill-showcase-footer"><i class="bi bi-stars"></i><span>' + esc(footer) + '</span></div>' +
            '</div>' +
          '</article>' +
        '</div>';
      }).join("");
    }

    // Experience
    const experienceGrid = document.getElementById("experienceGrid");
    if (experienceGrid) {
      experienceGrid.innerHTML = (data.experience || []).map(item => `<div class="col-lg-6 reveal">
        <article class="project-card h-100">
          <div class="project-icon"><i class="bi ${esc(item.icon || "bi-briefcase")}"></i></div>
          <div class="project-body">
            <span class="project-label">${esc(item.duration || "EXPERIENCE")}</span>
            <h4>${esc(item.role)}</h4>
            <p class="accent-text">${esc(item.company)}</p>
            <p>${esc(item.description)}</p>
            ${item.bullets ? `<ul class="muted ps-3">${String(item.bullets).split("|").map(b => `<li class="mb-2">${esc(b)}</li>`).join("")}</ul>` : ""}
            <div class="tags mt-3">${split(item.tech).map(t => `<span>${esc(t)}</span>`).join("")}</div>
          </div>
        </article>
      </div>`).join("");
    }

    // Education
    const educationGrid = document.getElementById("educationGrid");
    if (educationGrid) {
      const education = data.education || [];
      const cards = education.map(item => `<div class="col-lg-6 reveal">
        <article class="project-card h-100">
          <div class="project-icon"><i class="bi ${esc(item.icon || "bi-mortarboard")}"></i></div>
          <div class="project-body">
            <span class="project-label">${esc(item.duration || "EDUCATION")}</span>
            <h4>${esc(item.degree)}</h4>
            <p class="accent-text">${esc(item.institution)}</p>
            <p>${esc(item.description)}</p>
            <div class="tags">${split(item.tags, "|").map(t => `<span>${esc(t)}</span>`).join("")}</div>
          </div>
        </article>
      </div>`).join("");
      const certCard = `<div class="col-lg-6 reveal">
        <article class="project-card h-100 certification-card" data-bs-toggle="modal" data-bs-target="#certificationModal" role="button" tabindex="0" aria-label="View all certifications">
          <div class="project-icon"><i class="bi bi-patch-check-fill"></i></div>
          <div class="project-body">
            <span class="project-label">CERTIFICATIONS</span>
            <h4>Verified Learning</h4>
            <p>Completed multiple verified courses across programming, frontend development, full-stack development and data science.</p>
            <div class="tags"><span>${esc((data.certifications || []).length)}+ Certifications</span><span>View Certificates</span></div>
            <div class="certificate-link mt-4">View All Certificates <i class="bi bi-arrow-up-right"></i></div>
          </div>
        </article>
      </div>`;
      educationGrid.innerHTML = cards + certCard;
    }

    // Certifications
    const certGrid = document.getElementById("certificationsGrid");
    if (certGrid) {
      certGrid.innerHTML = (data.certifications || []).map(cert => `<div class="col-md-6">
        <div class="certificate-item">
          <div class="certificate-info">
            <div class="certificate-icon"><i class="bi ${esc(cert.icon || "bi-file-earmark-pdf")}"></i></div>
            <div><h5>${esc(cert.title)}</h5><p>${esc(cert.issuer)}</p><small>${esc(cert.date)}</small></div>
          </div>
          <a href="${esc(cert.url)}" target="_blank" class="certificate-btn">View Certificate <i class="bi bi-box-arrow-up-right"></i></a>
        </div>
      </div>`).join("");
    }

    // Contact
    const contactLead = document.getElementById("contactLead");
    if (contactLead) contactLead.textContent = p.bio || "";
    const email = document.getElementById("contactEmail");
    const phone = document.getElementById("contactPhone");
    const linkedin = document.getElementById("contactLinkedin");
    const github = document.getElementById("contactGithub");
    if (email) email.textContent = p.email || "";
    if (phone) phone.textContent = p.phone || "";
    if (linkedin) linkedin.textContent = (p.linkedin || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (github) github.textContent = (p.github || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

    const emailLink = document.querySelector('.contact-list a[href="#contact"]');
    if (emailLink) emailLink.href = "#contact";
    const phoneLink = phone?.closest("a");
    if (phoneLink && p.phone) phoneLink.href = "tel:" + p.phone.replace(/[^+\d]/g, "");
    const linkedinLink = linkedin?.closest("a");
    if (linkedinLink && p.linkedin) linkedinLink.href = p.linkedin;
    const githubLink = github?.closest("a");
    if (githubLink && p.github) githubLink.href = p.github;

    const resume = document.querySelector('.hero a[download]');
    if (resume && p.resume) resume.href = p.resume;

    const footerName = document.querySelector(".footer p");
    if (footerName && p.name) footerName.innerHTML = `© <span id="year"></span> ${esc(p.name)}. Built with Bootstrap 5.`;
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    observeReveals();
  }

  function observeReveals() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add("show");
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
  }

  // Theme
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("portfolio-theme");
  if (savedTheme === "light") document.body.classList.add("light");
  if (themeToggle) {
    const updateThemeIcon = () => {
      themeToggle.innerHTML = document.body.classList.contains("light")
        ? '<i class="bi bi-moon-fill"></i>' : '<i class="bi bi-sun-fill"></i>';
    };
    updateThemeIcon();
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light");
      localStorage.setItem("portfolio-theme", document.body.classList.contains("light") ? "light" : "dark");
      updateThemeIcon();
    });
  }

  document.querySelectorAll(".navbar .nav-link").forEach(link => {
    link.addEventListener("click", () => {
      const nav = document.getElementById("navContent");
      if (nav?.classList.contains("show")) bootstrap.Collapse.getOrCreateInstance(nav).hide();
    });
  });

  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", async e => {
      e.preventDefault();
      const submitButton = document.getElementById("contactSubmit");
      const submitText = document.getElementById("submitText");
      const submitLoading = document.getElementById("submitLoading");
      const successMessage = document.getElementById("contactSuccess");
      const errorMessage = document.getElementById("contactError");
      successMessage.style.display = "none";
      errorMessage.style.display = "none";
      submitButton.disabled = true;
      submitText.style.display = "none";
      submitLoading.style.display = "inline";
      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: new FormData(contactForm),
          headers: { Accept: "application/json" }
        });
        if (response.ok) {
          successMessage.style.display = "block";
          contactForm.reset();
        } else errorMessage.style.display = "block";
      } catch {
        errorMessage.style.display = "block";
      } finally {
        submitButton.disabled = false;
        submitText.style.display = "inline";
        submitLoading.style.display = "none";
      }
    });
  }

  loadPortfolio();
});