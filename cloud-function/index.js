const fs = require('fs');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const PORT = process.env.PORT || 8080;
const VALID_STATS = new Set([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
]);

const PROJECT_ID =
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  '';
const MISSING_PROJECT_MESSAGE =
  'Vertex project ID is not configured. Set VERTEX_PROJECT_ID or ensure GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT is available.';
if (!PROJECT_ID) {
  console.warn(
    'Codex Vitae backend started without a Vertex AI project ID. Set the VERTEX_PROJECT_ID environment variable or rely on GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT when running on Google Cloud.'
  );
}

const CREDENTIALS_PATH = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
const MISSING_CREDENTIALS_MESSAGE = (() => {
  if (!CREDENTIALS_PATH) {
    return '';
  }
  try {
    const stats = fs.statSync(CREDENTIALS_PATH);
    if (!stats.isFile()) {
      return `Credential file not found at ${CREDENTIALS_PATH}.`;
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return `Credential file not found at ${CREDENTIALS_PATH}.`;
    }
    return `Unable to access credential file at ${CREDENTIALS_PATH}: ${error.message}`;
  }
  return '';
})();
if (MISSING_CREDENTIALS_MESSAGE) {
  console.error(MISSING_CREDENTIALS_MESSAGE);
}

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const TEXT_MODEL = process.env.VERTEX_TEXT_MODEL || 'gemini-1.5-pro';
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'imagegeneration@002';

const ERROR_CODES = {
  vertexAuthTimeout: 'VERTEX_AUTH_TIMEOUT',
  vertexRequestTimeout: 'VERTEX_REQUEST_TIMEOUT'
};

const VERTEX_AUTH_TIMEOUT_MS = 20000;
const VERTEX_REQUEST_TIMEOUT_MS = 45000;

function createTimeoutError(message, code) {
  const error = new Error(message);
  if (code) {
    error.code = code;
  }
  return error;
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(typeof onTimeout === 'function' ? onTimeout() : createTimeoutError(onTimeout));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

const googleAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
let authClientPromise;

async function getAuthClient() {
  if (!authClientPromise) {
    authClientPromise = (async () => {
      try {
        return await withTimeout(
          googleAuth.getClient(),
          VERTEX_AUTH_TIMEOUT_MS,
          () => createTimeoutError(
            'Timed out while acquiring Google auth client for Vertex AI.',
            ERROR_CODES.vertexAuthTimeout
          )
        );
      } catch (error) {
        authClientPromise = null;
        throw error;
      }
    })();
  }
  return authClientPromise;
}

async function getAccessToken() {
  const client = await getAuthClient();
  const accessToken = await withTimeout(
    client.getAccessToken(),
    VERTEX_AUTH_TIMEOUT_MS,
    () => createTimeoutError(
      'Timed out while acquiring access token for Vertex AI.',
      ERROR_CODES.vertexAuthTimeout
    )
  );
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error('Unable to acquire access token for Vertex AI.');
  }
  return token;
}

async function callVertex(model, body) {
  if (MISSING_CREDENTIALS_MESSAGE) {
    throw new Error(MISSING_CREDENTIALS_MESSAGE);
  }
  if (!PROJECT_ID) {
    throw new Error(MISSING_PROJECT_MESSAGE);
  }
  // --- BEGIN: canonical Vertex config ---
  const project =
    process.env.VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    PROJECT_ID;

  const location = process.env.VERTEX_LOCATION || LOCATION || 'us-central1';
  const chosenModel = process.env.VERTEX_MODEL || model || 'gemini-1.5-pro-002';

  // host: us-central1 -> us-central1-aiplatform.googleapis.com
  //       us          -> us-aiplatform.googleapis.com
  const host = `${location}-aiplatform.googleapis.com`;

  const vertexUrl = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${chosenModel}:generateContent`;
  console.log('[VertexURL]', vertexUrl, { project, location, chosenModel });
  // --- END: canonical Vertex config ---

  const token = await getAccessToken();
  const { data } = await axios.post(vertexUrl, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });
  return data;
  try {
    const { data } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: VERTEX_REQUEST_TIMEOUT_MS
    });
    return data;
  } catch (error) {
    const timeoutTriggered =
      error?.code === 'ECONNABORTED' ||
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'AbortError' ||
      typeof error?.message === 'string' && error.message.toLowerCase().includes('timeout');
    if (timeoutTriggered) {
      throw createTimeoutError('Vertex AI request timed out.', ERROR_CODES.vertexRequestTimeout);
    }
    throw error;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

function isConfigurationError(error) {
  const message = error?.message;
  return Boolean(
    message === MISSING_PROJECT_MESSAGE ||
    (MISSING_CREDENTIALS_MESSAGE && message === MISSING_CREDENTIALS_MESSAGE)
  );
}

function isVertexTimeoutError(error) {
  const code = error?.code;
  return code === ERROR_CODES.vertexAuthTimeout || code === ERROR_CODES.vertexRequestTimeout;
}

function ensureProjectConfigured(res) {
  if (MISSING_CREDENTIALS_MESSAGE) {
    res.status(500).json({ error: MISSING_CREDENTIALS_MESSAGE });
    return false;
  }
  if (PROJECT_ID) {
    return true;
  }
  res.status(500).json({ error: MISSING_PROJECT_MESSAGE });
  return false;
}

app.get('/healthz', (req, res) => {
  const projectConfigured = Boolean(PROJECT_ID);
  const credentialsValid = !MISSING_CREDENTIALS_MESSAGE;
  const ok = projectConfigured && credentialsValid;
  const status = ok ? 200 : 500;
  const messages = [];
  if (!projectConfigured) {
    messages.push(MISSING_PROJECT_MESSAGE);
  }
  if (!credentialsValid) {
    messages.push(MISSING_CREDENTIALS_MESSAGE);
  }
  const response = {
    ok,
    vertexProjectConfigured: projectConfigured,
    credentialFileValid: credentialsValid
  };
  if (messages.length === 1) {
    response.message = messages[0];
  } else if (messages.length > 1) {
    response.messages = messages;
  }
  res.status(status).json(response);
});

app.post('/classify-chore', async (req, res) => {
  if (!ensureProjectConfigured(res)) {
    return;
  }
  try {
    const text = (req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const response = await callVertex(TEXT_MODEL, {
      system_instruction: {
        role: 'system',
        parts: [
          {
            text:
              'You are a game systems assistant. Classify the supplied household chore into one of the following stats: strength, dexterity, constitution, intelligence, wisdom, or charisma. Respond ONLY with JSON shaped exactly as {"stat": "<stat>", "effort": <integer between 1 and 100>}.'
          }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200
      }
    });

    const candidate = response?.candidates?.[0];
    const raw = (candidate?.content?.parts || [])
      .map(part => part.text || '')
      .join('')
      .trim();

    if (!raw) {
      throw new Error('Model response did not contain text.');
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed) {
      throw new Error(`Unable to parse model response: ${raw}`);
    }

    let stat = String(parsed.stat || '').toLowerCase();
    if (!VALID_STATS.has(stat)) {
      stat = 'constitution';
    }

    let effort = Number(parsed.effort);
    if (!Number.isFinite(effort)) {
      effort = 10;
    } else {
      effort = Math.max(1, Math.min(100, Math.round(effort)));
    }

    res.json({ stat, effort });
  } catch (error) {
    if (isConfigurationError(error)) {
      res.status(500).json({ error: error.message });
    } else if (isVertexTimeoutError(error)) {
      console.warn('classify-chore timeout', error.message);
      res.status(504).json({ error: error.message });
    } else {
      console.error('classify-chore error', error);
      res.status(502).json({ error: 'Classification failed.' });
    }
  }
});

app.post('/generate-avatar', async (req, res) => {
  if (!ensureProjectConfigured(res)) {
    return;
  }
  try {
    const imageBase64 = req.body?.imageBase64;
    const prompt =
      req.body?.prompt ||
      'Create a stylized RPG portrait of this person. Preserve facial features, add heroic sci-fi lighting, and paint in a semi-realistic digital art style.';

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const sanitizedImage = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

    const response = await callVertex(IMAGE_MODEL, {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: sanitizedImage
              }
            }
          ]
        }
      ]
    });

    const imagePart = (response?.candidates || [])
      .flatMap(candidate => candidate?.content?.parts || [])
      .find(part => part.inline_data?.data);

    const generatedImage = imagePart?.inline_data?.data;
    const generatedMime = imagePart?.inline_data?.mime_type || 'image/png';

    if (!generatedImage) {
      throw new Error('Model response did not include an image.');
    }

    res.json({ imageUrl: `data:${generatedMime};base64,${generatedImage}` });
  } catch (error) {
    if (isConfigurationError(error)) {
      res.status(500).json({ error: error.message });
    } else if (isVertexTimeoutError(error)) {
      console.warn('generate-avatar timeout', error.message);
      res.status(504).json({ error: error.message });
    } else {
      console.error('generate-avatar error', error);
      res.status(502).json({ error: 'Avatar generation failed.' });
    }
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Codex Vitae backend listening on port ${PORT}`);
});
