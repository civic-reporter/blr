# Nāgarika Dhvani — BLR

Static front-end webpage for the Nāgarika Dhvani project. Built with plain HTML, CSS and JavaScript and intended for static hosting (GitHub Pages, Netlify, Vercel, S3, etc.).

Status
- Static client-side site. No server-side components included in this repository.
- Main entry: `index.html` (repository root).
- Static assets live under `assets/`.
- LICENSE (MIT) present in the repository root.

Language composition
- HTML — 37%  
- CSS — 36.7%  
- JavaScript — 26.3%

Repository layout (relevant)
- index.html — main entry page
- assets/
  - assets/css/ — stylesheets
  - assets/js/ — JavaScript files
  - assets/img/ — images and screenshots (recommended)
- .github/ — CI/workflow configs (if present)
- LICENSE — MIT license
- README.md — this file

Screenshots
Place screenshot files in `assets/img/` (or `screenshots/`) and update paths below as needed.

- assets/img/homepage.png — Homepage preview
- assets/img/map.png — Map / data view
- assets/img/chat.png — Chat view

Quick start — preview locally
1. Clone the repository:
   git clone https://github.com/civic-reporter/blr.git
2. Change into the project directory:
   cd blr
3. Preview directly:
   - Double-click `index.html` to open in your browser (note: some browsers may block local fetch/XHR via file://).
4. Recommended: run a local static server (to avoid CORS when fetching files)
   - Python 3:
     python -m http.server 8000
     Open http://localhost:8000
   - Node (http-server):
     npm install -g http-server
     http-server -p 8000
     Open http://localhost:8000

Development notes
- Edit HTML files at the repo root.
- Edit CSS under `assets/css/`.
- Edit JavaScript under `assets/js/`.
- Add images/screenshots to `assets/img/`.
- If your client code fetches external data files, serve the site over HTTP during development to mirror hosting behavior.

Deployment
- GitHub Pages:
  - Enable Pages in repository settings and choose the main branch (root) as the publishing source.
- Netlify / Vercel:
  - Connect the repo and set the publish directory to the repository root (or the folder containing `index.html`).
- S3 / Firebase / other static hosting:
  - Upload `index.html` and the `assets/` directory. Configure `index.html` as the default document.

Contributing
- Open a pull request with:
  - A short description of the change and rationale.
  - Screenshots for UI changes.
  - Any notes about data-format changes.
- Coding guidelines:
  - Use semantic HTML and accessible patterns (alt attributes on images, ARIA where needed).
  - Keep CSS modular and maintainable.
  - Keep JavaScript modular and document expected data structures for any data files.

License
This project is licensed under the MIT License. See LICENSE for full text.

Maintainers / Contact
- Maintainers: Nāgarika Dhvani contributors (generic)
- For questions or support, open an issue in this repository.
