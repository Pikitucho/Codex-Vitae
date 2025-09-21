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

const PROJECT_ID = process.env.VERTEX_PROJECT_ID;
if (!PROJECT_ID) {
  throw new Error('VERTEX_PROJECT_ID must be set before starting the Codex Vitae backend.');
}

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const TEXT_MODEL = process.env.VERTEX_TEXT_MODEL || 'gemini-1.0-pro';
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'imagegeneration@002';

const googleAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
let authClientPromise;

async function getAuthClient() {
  if (!authClientPromise) {
    authClientPromise = googleAuth.getClient();
  }
  return authClientPromise;
}

async function getAccessToken() {
  const client = await getAuthClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error('Unable to acquire access token for Vertex AI.');
  }
  return token;
}

async function callVertex(model, body) {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
  const token = await getAccessToken();
  const { data } = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });
  return data;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.post('/classify-chore', async (req, res) => {
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
    console.error('classify-chore error', error);
    res.status(502).json({ error: 'Classification failed.' });
  }
});

app.post('/generate-avatar', async (req, res) => {
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
    console.error('generate-avatar error', error);
    res.status(502).json({ error: 'Avatar generation failed.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Codex Vitae backend listening on port ${PORT}`);
});
