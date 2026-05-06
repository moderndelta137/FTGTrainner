# Execution Frame Trainer

A fighting game input training project based on the GDD in `GDD.txt`. The app currently runs as a static React page with Tailwind CSS, browser-native input APIs, and no build step.

## Local Development

```bash
npm run dev
```

The local server will print a URL, usually `http://127.0.0.1:5173/`.

On Windows PowerShell, if `npm` is blocked by the execution policy, run:

```bash
node scripts/server.mjs
```

## Static Hosting

The deployable app is the repository root: `index.html` plus the files under `src/`.

## GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. To deploy:

1. Push the project to GitHub.
2. Open the repository settings.
3. Go to Pages.
4. Set **Build and deployment** to **GitHub Actions**.
5. Push to the `main` branch or run the workflow manually.

The page uses relative paths so it can run under a GitHub Pages project URL.
