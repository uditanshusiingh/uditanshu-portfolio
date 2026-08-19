document.addEventListener("DOMContentLoaded", () => {
  const roles = [
    "Web Developer",
    "Frontend Developer",
    "Full Stack Developer",
    "Computer Science Student"
  ];

  const typed = document.getElementById("typedRole");

  let roleIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function typeLoop() {
    const word = roles[roleIndex];

    typed.textContent = deleting
      ? word.slice(0, --charIndex)
      : word.slice(0, ++charIndex);

    let delay = deleting ? 55 : 90;

    if (!deleting && charIndex === word.length) {
      delay = 1300;
      deleting = true;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      delay = 350;
    }

    setTimeout(typeLoop, delay);
  }

  typeLoop();

  /* =========================
     Theme Toggle
  ========================= */

  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("portfolio-theme");

  if (savedTheme === "light") {
    document.body.classList.add("light");
  }

  updateThemeIcon();

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");

    localStorage.setItem(
      "portfolio-theme",
      document.body.classList.contains("light") ? "light" : "dark"
    );

    updateThemeIcon();
  });

  function updateThemeIcon() {
    themeToggle.innerHTML = document.body.classList.contains("light")
      ? '<i class="bi bi-moon-fill"></i>'
      : '<i class="bi bi-sun-fill"></i>';
  }

  /* =========================
     Current Year
  ========================= */

  document.getElementById("year").textContent = new Date().getFullYear();

  /* =========================
     Scroll Reveal Animation
  ========================= */

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  document.querySelectorAll(".reveal").forEach((el) => {
    observer.observe(el);
  });

  /* =========================
     Mobile Navbar
  ========================= */

  document.querySelectorAll(".navbar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      const nav = document.getElementById("navContent");

      if (nav.classList.contains("show")) {
        bootstrap.Collapse.getOrCreateInstance(nav).hide();
      }
    });
  });

  /* =========================
     Contact Form
  ========================= */

  document.getElementById("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();
    const note = document.getElementById("formNote");

    if (!name || !email || !subject || !message) {
      return;
    }

    const mailto = `mailto:uditsingh9939@gmail.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )}`;

    note.innerHTML =
      'Opening your email app... <i class="bi bi-check-circle"></i>';

    note.style.color = "var(--secondary)";

    window.location.href = mailto;
  });
});

/* ================= CONTACT FORM ================= */

const contactForm = document.getElementById("contactForm");

if (contactForm) {

  contactForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    const submitButton = document.getElementById("contactSubmit");
    const submitText = document.getElementById("submitText");
    const submitLoading = document.getElementById("submitLoading");

    const successMessage = document.getElementById("contactSuccess");
    const errorMessage = document.getElementById("contactError");

    // Reset messages
    successMessage.style.display = "none";
    errorMessage.style.display = "none";

    // Loading state
    submitButton.disabled = true;
    submitText.style.display = "none";
    submitLoading.style.display = "inline";

    try {

      const response = await fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: {
          "Accept": "application/json"
        }
      });

      if (response.ok) {

        successMessage.style.display = "block";

        contactForm.reset();

      } else {

        errorMessage.style.display = "block";

      }

    } catch (error) {

      errorMessage.style.display = "block";

    } finally {

      submitButton.disabled = false;
      submitText.style.display = "inline";
      submitLoading.style.display = "none";

    }

  });

}