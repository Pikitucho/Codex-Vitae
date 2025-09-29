const express = require('express');
const cors = require('cors');
const axios = require('axios');

const PORT = process.env.PORT || 8080;
const VALID_STATS = new Set([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
]);

function normalizeGeminiModel(name) {
  const fallback = 'gemini-1.5-flash-latest';
  let base = (name || '').trim();
  if (!base) {
    return fallback;
  }
  const suffixPattern = /-(?:00\d+|preview[\w-]*|latest)$/i;
  while (suffixPattern.test(base)) {
    base = base.replace(suffixPattern, '');
  }
  return `${base}-latest`;
}

const TEXT_MODEL = normalizeGeminiModel(process.env.GENAI_MODEL || 'gemini-1.5-flash-latest');

async function callGemini(model, body) {
  const normalizedModel = normalizeGeminiModel(model || TEXT_MODEL);
  const apiKey = (process.env.GENAI_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('GENAI_API_KEY environment variable is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${normalizedModel}:generateContent?key=${apiKey}`;

  try {
    const { data } = await axios.post(endpoint, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return data;
  } catch (error) {
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const message = error?.message;
    const data = error?.response?.data;
    const safeEndpoint = apiKey ? endpoint.replace(apiKey, '***') : endpoint;
    console.error('Gemini request error', {
      status,
      statusText,
      endpoint: safeEndpoint,
      message,
      data
    });
    throw error;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/healthz', (req, res) => {
  const apiKeyConfigured = Boolean((process.env.GENAI_API_KEY || '').trim());
  const response = {
    ok: apiKeyConfigured,
    genaiApiKeyConfigured: apiKeyConfigured,
    model: TEXT_MODEL
  };
  res.status(apiKeyConfigured ? 200 : 500).json(response);
});

app.post('/classify-chore', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const response = await callGemini(TEXT_MODEL, {
      systemInstruction: {
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
    const parts = candidate?.content?.parts || [];
    const raw = parts.map(part => part?.text || '').join('').trim();

    if (!raw) {
      const error = new Error('Model response did not contain text.');
      error.statusCode = 502;
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        parsed = JSON.parse(fenceMatch[1]);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      const error = new Error('Unable to parse model response as JSON.');
      error.statusCode = 502;
      throw error;
    }

    const stat = String(parsed.stat || '').trim().toLowerCase();
    const effort = Number(parsed.effort);

    if (!stat || !VALID_STATS.has(stat)) {
      const error = new Error('Model response did not include a valid stat.');
      error.statusCode = 502;
      throw error;
    }

    if (!Number.isFinite(effort) || effort < 1 || effort > 100) {
      const error = new Error('Model response did not include a valid effort between 1 and 100.');
      error.statusCode = 502;
      throw error;
    }

    res.json({ stat, effort: Math.round(effort) });
  } catch (error) {
    console.error('classify-chore error', error?.message || error);
    const status = error?.statusCode || error?.status || 502;
    res.status(status).json({ error: error?.message || 'Classification failed.' });
  }
});

app.post('/generate-avatar', (req, res) => {
  res
    .status(501)
    .json({ error: 'Avatar generation is not available in the Gemini-only backend.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Codex Vitae backend listening on port ${PORT}`);
});
