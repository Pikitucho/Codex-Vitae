# Codex Vitae Backend Service

This directory contains the Express application that fronts calls to Vertex AI for the Codex Vitae project. The server looks for several environment variables at startup. Missing required values no longer prevent the process from booting, but requests that need Vertex AI will fail with a 500 error until the configuration is provided.

## Required configuration

The Vertex AI project ID is discovered from the following environment variables in order:

1. `VERTEX_PROJECT_ID`
2. `GOOGLE_CLOUD_PROJECT`
3. `GCLOUD_PROJECT`

Set `VERTEX_PROJECT_ID` explicitly when running locally. When the service runs on Google Cloud (Cloud Run, Cloud Functions, etc.), Google automatically sets `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`, so the backend can use those values without extra configuration. If none of these variables are set, the health check exposes `vertexProjectConfigured: false` and the service responds to API calls with:

```
{
  "error": "Vertex project ID is not configured. Set VERTEX_PROJECT_ID or ensure GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT is available."
}
```

## Optional configuration

- `VERTEX_LOCATION` (defaults to `us-central1`)
- `VERTEX_TEXT_MODEL` (defaults to `gemini-1.0-pro`)
- `VERTEX_IMAGE_MODEL` (defaults to `imagegeneration@002`)

## Local development

Install dependencies once:

```bash
npm install
```

Start the server with your project configuration:

```bash
VERTEX_PROJECT_ID=my-project \
VERTEX_LOCATION=us-central1 \
node index.js
```

Alternatively, you can export the variables in your shell or load them via a tool like [direnv](https://direnv.net/).

The backend authenticates using the default Google credentials available to the process. When running locally you typically supply a service account key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/my-service-account.json"
```

Then start the server as shown above.

## Deployment

When deploying to Google-managed environments (Cloud Run, Cloud Functions, etc.), the platform automatically sets `GOOGLE_CLOUD_PROJECT` and/or `GCLOUD_PROJECT` to the hosting project. You may optionally set `VERTEX_PROJECT_ID` explicitly if you need to target a different project.

Configure any non-default values for `VERTEX_LOCATION`, `VERTEX_TEXT_MODEL`, or `VERTEX_IMAGE_MODEL` as additional environment variables in your deployment settings.

The `/healthz` endpoint always responds with HTTP 200 and includes a `vertexProjectConfigured` flag so you can verify that the Vertex project ID was discovered correctly.
