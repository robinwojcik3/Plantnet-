# Plantouille Express

Plantouille Express is a progressive web application for plant identification built using the PlantNet API. The project also integrates Google Gemini and Google Text‑to‑Speech for generating short descriptions and audio.

## Prerequisites

- A recent web browser supporting service workers.
- Optional: **Netlify CLI** for local testing.


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

## Running the application locally

1. Serve the project from a local HTTP server (for example using `npx serve` or `python3 -m http.server`).
2. Open `http://localhost:PORT/index.html` in your browser. Service workers require an HTTP context, so opening the file directly will not work.

## Deploying to Netlify

1. Push the project to a Git repository (e.g. GitHub).
2. In Netlify, create a new site from your repository.
3. Netlify automatically reads the `netlify.toml` configuration and publishes the root directory.
4. In the site settings, add your API keys as environment variables or embed them directly in `app.js` before deploying.
5. Trigger a deploy. Once finished, your application is accessible from the generated Netlify URL.

