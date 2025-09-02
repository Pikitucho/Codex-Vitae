const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const app = express();

// *** FIX: Use a more robust CORS configuration for the environment ***
app.use(cors());
// *** END FIX ***

app.use(express.json({ limit: '10mb' }));

const PROJECT_ID = 'codex-vitae-470801';
const LOCATION = 'us-central1';
const MODEL_ID = 'imagegeneration@006';

const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com`;
const MODEL_ENDPOINT_URL = `${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict`;

app.post('/', async (req, res) => {
    if (!req.body.image) {
        return res.status(400).send('No image data provided.');
    }

    try {
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        const requestBody = {
            "instances": [{
                "prompt": "A beautiful, Ghibli-inspired digital painting of the person, rpg fantasy character portrait, cinematic, stunning",
                "image": { "bytesBase64Encoded": req.body.image }
            }],
            "parameters": {
                "sampleCount": 1
            }
        };

        const response = await axios.post(MODEL_ENDPOINT_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const imageBase64 = response.data.predictions[0].bytesBase64Encoded;
        res.status(200).json({ base64Image: imageBase64 });

    } catch (error) {
        console.error('ERROR:', error.response ? error.response.data : error.message);
        res.status(500).send(`Error processing image: ${error.message}`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
