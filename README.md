# Plantouille Express

Plantouille Express is a progressive web application for plant identification built using the PlantNet API. The project also integrates Google Gemini and Google Text‑to‑Speech for generating short descriptions and audio.

## Prerequisites

- **Node.js** and **npm** for running Netlify serverless functions.
- A recent web browser supporting service workers.
- Optional: **Netlify CLI** for local testing.

## Installing Node dependencies

Serverless functions rely on `jsdom` and `node-fetch`. Install them in the `netlify/functions` folder:

```bash
npm init -y               # if you do not already have a package.json
npm install jsdom node-fetch
```

The function `inpn-proxy.js` requires these modules as shown below:

```javascript
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
```

## Configuring API keys

Edit `app.js` and replace the placeholder values with your own API keys:

```javascript
const API_KEY  = "your-plantnet-key";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const GEMINI_API_KEY = "your-gemini-key";
const TTS_API_KEY    = "your-text-to-speech-key";
```

These keys are required for PlantNet image identification, Gemini summaries and Google TTS audio synthesis.

## Configuring Supabase

The notebook feature relies on a Supabase backend for authentication and storage. Edit `notebook.js` and replace the placeholder values of `SUPABASE_URL` and `SUPABASE_KEY` with your own project credentials. Without these keys, creating an account or logging in will display a configuration error.

## Running the application locally

1. Serve the project from a local HTTP server (for example using `npx serve` or `python3 -m http.server`).
2. Open `http://localhost:PORT/index.html` in your browser. Service workers require an HTTP context, so opening the file directly will not work.
3. For serverless functions, install Netlify CLI and run:

```bash
npm install -g netlify-cli
netlify dev
```

This emulates the Netlify environment and exposes the functions under `/.netlify/functions/`.

## Deploying to Netlify

1. Push the project to a Git repository (e.g. GitHub).
2. In Netlify, create a new site from your repository.
3. Netlify automatically reads the `netlify.toml` configuration, publishing the root directory and bundling functions from `netlify/functions`.
4. In the site settings, add your API keys as environment variables or embed them directly in `app.js` before deploying.
5. Trigger a deploy. Once finished, your application is accessible from the generated Netlify URL.

