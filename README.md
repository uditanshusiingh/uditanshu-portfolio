# Uditanshu Kumar — Personal Portfolio

A modern, responsive personal portfolio and content-management system built for **Uditanshu Kumar**.

The project started as a static Bootstrap portfolio and has evolved into a **dynamic portfolio platform with a secure admin panel**, centralized JSON content, GitHub-backed publishing, certificate/resume uploads, theme support, and Vercel serverless APIs.

**Live Portfolio:** https://uditanshu-portfolio.vercel.app/  
**Repository:** https://github.com/uditanshusiingh/uditanshu-portfolio

---

## ✨ Features

### Public Portfolio

- Responsive portfolio built with **HTML5, CSS3 and Bootstrap 5**
- Vanilla JavaScript rendering from centralized portfolio data
- Hero section with animated roles
- About section with dynamic profile information and stats
- Projects showcase with configurable **priority/order**
- Skills showcase grouped by category
- Compact, reusable experience cards
- Education timeline/cards
- Certification modal with dynamically rendered certificates
- Resume download
- Contact section with Formspree submission
- GitHub and LinkedIn links
- Dark / light theme toggle
- Scroll reveal animations
- Responsive layouts for desktop, tablet and mobile
- Bootstrap Icons throughout the interface

### Admin Panel

The portfolio includes a protected admin dashboard at:

`/admin/`

Admin sections:

- Dashboard
- Profile
- Projects
- Skills
- Experience
- Education
- Certifications
- Messages
- Settings

From the admin panel you can:

- Update profile information
- Add, edit and delete projects
- Set project display priority
- Add and manage skills
- Add and manage experience entries
- Add and manage education
- Upload and delete PDF certificates
- Upload a resume using drag & drop
- Export portfolio data as JSON
- Import a previous JSON backup
- Toggle admin-panel theme
- Open the public portfolio directly from the sidebar

---

## 🏗️ Architecture

The project uses a centralized content model:

```
data/portfolio.json
        │
        ▼
/api/portfolio-data
        │
        ▼
     script.js
        │
        ▼
  Public Portfolio
```

The admin panel updates the same central data source:

```
Admin Panel
    │
    ▼
/api/portfolio-data
    │
    ▼
GitHub Contents API
    │
    ▼
data/portfolio.json
    │
    ▼
Vercel Deployment
    │
    ▼
Public Portfolio
```

This means future content added through the admin panel follows the same rendering and styling system automatically.

For example, a new experience added from **Admin → Experience** is rendered with the same `experience-card` component and shared CSS as existing experience entries.

---

## 📁 Project Structure

```
uditanshu-portfolio/
│
├── index.html
├── style.css
├── script.js
├── package.json
├── README.md
│
├── data/
│   └── portfolio.json
│
├── admin/
│   ├── index.html
│   ├── admin.css
│   └── admin.js
│
├── api/
│   ├── portfolio-data.js
│   ├── upload-resume.js
│   ├── upload-certificate.js
│   ├── delete-certificate.js
│   │
│   └── auth/
│       ├── login.js
│       ├── logout.js
│       ├── me.js
│       └── _session.js
│
├── assets/
│   ├── profile/
│   ├── certificates/
│   └── resumes/
│
└── ...
```

---

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| UI Framework | Bootstrap 5 |
| Icons | Bootstrap Icons |
| Backend/API | Vercel Serverless Functions |
| File Uploads | Formidable |
| Content Store | GitHub repository / JSON |
| Authentication | HttpOnly session cookie |
| Publishing | GitHub Contents API + Vercel |
| Contact Form | Formspree |
| Deployment | Vercel |
| Runtime | Node.js 24.x |

---

## 🔐 Admin Authentication

The admin panel uses server-side credentials and an **HttpOnly session cookie**.

Required Vercel environment variables:

```env
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-admin-password
ADMIN_SESSION_SECRET=your-long-random-secret
```

Do **not** commit these values to GitHub.

The authentication flow is:

```
Admin Login
    ↓
/api/auth/login
    ↓
Credentials validated
    ↓
Secure HttpOnly session cookie
    ↓
Protected admin operations
```

---

## 🔑 GitHub Publishing Configuration

The admin panel publishes portfolio changes through the GitHub Contents API.

Configure these Vercel environment variables:

```env
GITHUB_TOKEN=your-github-token
GITHUB_REPO=uditanshusiingh/uditanshu-portfolio
```

Important:

- `GITHUB_REPO` must use the `owner/repository` format.
- Do **not** put `https://github.com/` in `GITHUB_REPO`.
- Keep `GITHUB_TOKEN` private.
- The token is used server-side only.
- The API includes retry handling for GitHub SHA conflicts when multiple updates occur.

---

## 📄 Resume Upload

The admin profile section provides a drag-and-drop resume uploader.

Supported formats:

- PDF
- DOC
- DOCX

Maximum file size:

**10 MB**

Uploaded resumes are stored under:

```
assets/resumes/
```

The selected resume path is then saved into `data/portfolio.json` and used by the public portfolio.

---

## 🏆 Certificate Management

Certificates can be managed directly from:

**Admin → Certifications**

Supported format:

- PDF

Maximum file size:

**10 MB**

When a certificate is uploaded:

1. The PDF is saved under `assets/certificates/`.
2. The certificate metadata is added to `data/portfolio.json`.
3. The public certification list is rendered dynamically.
4. The change is committed to GitHub.
5. Vercel can deploy the updated portfolio automatically.

Certificate deletion removes the certificate from the portfolio data and repository.

---

## 🔄 Dynamic Content

The public website reads its content from:

```
/api/portfolio-data
```

The API serves:

- Profile
- Projects
- Skills
- Experience
- Education
- Certifications

The public JavaScript uses cache-busting and `no-store` requests so updated admin content can be fetched without relying on an old browser/API cache.

---

## 🚀 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/uditanshusiingh/uditanshu-portfolio.git
cd uditanshu-portfolio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

Because the project contains Vercel serverless APIs, use the Vercel development environment when testing the complete admin/API workflow:

```bash
npx vercel dev
```

For only the static public page, you can also open `index.html` with a local static server.

---

## ☁️ Vercel Deployment

1. Import the GitHub repository into Vercel.
2. Use the project root as the deployment directory.
3. Set the required environment variables.
4. Deploy.
5. Open:

```
https://your-domain.vercel.app/
```

Admin panel:

```
https://your-domain.vercel.app/admin/
```

Every successful GitHub content update can trigger a new Vercel deployment when the repository is connected to Vercel.

---

## 🧩 Content Management

The central file is:

```
data/portfolio.json
```

It contains:

```text
profile
projects
skills
experience
education
certifications
```

### Project ordering

Projects support a `priority` field.

Lower numbers appear first:

```json
{
  "title": "My Project",
  "priority": 1
}
```

If no priority is supplied, the project is placed after explicitly ordered projects.

### Experience styling

All experience entries are rendered through the same dynamic component:

```html
<article class="project-card experience-card h-100">
```

The shared `.experience-card` CSS applies automatically to current and future experience entries.

---

## 🎨 Design System

The portfolio uses a dark, modern developer-focused visual system with:

- CSS custom properties
- Gradient accents
- Glassmorphism-inspired surfaces
- Responsive Bootstrap grid
- Rounded cards
- Hover transitions
- Reveal animations
- Dark/light theme variables
- Reusable project, skill, experience and certificate components

The admin interface follows the same visual language while using a denser dashboard layout.

---

## 📌 Current Portfolio Sections

The public website currently includes:

1. **Home**
2. **About**
3. **Skills**
4. **Experience**
5. **Projects**
6. **Education**
7. **Certifications**
8. **Contact**

---

## 👨‍💻 Author

**Uditanshu Kumar**

B.Tech — Computer Science & Engineering  
Haridwar University

- GitHub: https://github.com/uditanshusiingh
- LinkedIn: https://www.linkedin.com/in/uditanshusiingh/
- Portfolio: https://uditanshu-portfolio.vercel.app/

---

## 📜 License

This project is a personal portfolio project. The source code is available for learning and reference.

Personal assets such as profile images, certificates and resume belong to the respective owner and should not be reused without permission.


---

## 🔒 Private Document Vault

The admin panel includes a **Documents** section that works as a private personal document vault.

The vault is intentionally separate from the public portfolio:

- Documents never appear on the public website.
- Documents are stored in a **private Vercel Blob store**, not in the GitHub repository.
- Access requires the existing admin authentication session.
- Drag & drop and multi-file upload are supported.
- Large files use direct client-to-Blob uploads with multipart support.
- Every document shows its filename, size, file type, upload date/time and pinned status.
- Documents can be pinned, downloaded or permanently deleted.
- The vault can be accessed from any device by signing into the admin panel.
- Downloads are served through an authenticated server endpoint and sent as attachments.

Vercel Private Blob is designed for sensitive documents and requires authenticated access; public Blob storage should not be used for this vault. See the official Vercel documentation for private storage. 

### One-time Vercel setup

Create a **private** Blob store and connect it to this Vercel project:

1. Open the Vercel project.
2. Go to **Storage**.
3. Create a **Blob** store.
4. Set its access mode to **Private**.
5. Connect the store to the project and enable the production environment.
6. Vercel will provide the Blob credentials required by the server functions.
7. Redeploy the project.

The application expects:

```env
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

Do not commit this value to GitHub.

The vault uses the existing admin session for application-level authorization in addition to Vercel Blob's private storage controls.

### Vault flow

```
Admin login
    ↓
Documents section
    ↓
Drag & drop file
    ↓
Authenticated upload token
    ↓
Private Vercel Blob
    ↓
Encrypted/private cloud storage
    ↓
Authenticated list / download / pin / delete
```

The document vault is an **admin-only utility** and has no dependency on the public portfolio content model in `data/portfolio.json`.

