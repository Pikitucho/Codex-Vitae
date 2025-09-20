const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const PORT = process.env.PORT || 8080;
const VALID_STATS = new Set([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
]);

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY must be set before starting the Codex Vitae backend.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    const completion = await openai.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_output_tokens: 200,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a game systems assistant. Classify the supplied household chore into one of the following stats: strength, dexterity, constitution, intelligence, wisdom, or charisma. Respond ONLY with JSON shaped exactly as {"stat": "<stat>", "effort": <integer between 1 and 100>}.'
            }
          ]
        },
        {
          role: 'user',
          content: [{ type: 'text', text }]
        }
      ]
    });

    const raw = (completion.output_text || '').trim();
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

    const sanitizedImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const response = await openai.responses.create({
      model: process.env.OPENAI_AVATAR_MODEL || 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt
            },
            {
              type: 'input_image',
              image_base64: sanitizedImage
            }
          ]
        }
      ]
    });

    const imagePart = (response.output || [])
      .flatMap(item => item.content || [])
      .find(part => part.type === 'output_image');

    if (!imagePart?.image_base64) {
      throw new Error('Model response did not include an image.');
    }

    res.json({ imageUrl: `data:image/png;base64,${imagePart.image_base64}` });
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
