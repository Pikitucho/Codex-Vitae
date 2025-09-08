const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- CONFIGURATION ---
const PROJECT_ID = 'codex-vitae-app'; // Your Google Cloud Project ID
const LOCATION = 'us-central1'; // The region for your project

// Endpoint for the text classification AI model
const CLASSIFY_MODEL_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-1.0-pro:predict`;


// This endpoint is for your future AI Avatar feature
app.post('/generate-avatar', async (req, res) => {
    // We will build this out later
    res.status(501).send('Avatar generation not yet implemented.');
});


// --- NEW ENDPOINT for Chore Classification ---
app.post('/classify-chore', async (req, res) => {
    if (!req.body.text) {
        return res.status(400).send('Bad Request: No chore text provided.');
    }
    const choreText = req.body.text;

    try {
        // --- 1. Authenticate with Google Cloud ---
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        // --- 2. Create the AI Prompt ---
        // This is a carefully designed prompt to get a consistent JSON response from the AI.
        const prompt = `
            You are a game designer for a life-gamification app called Codex Vitae. Your task is to analyze a user's real-world chore and classify it into a "Stat" and an "Effort Tier".

            The "Stat" must be one of: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.
            The "Effort Tier" must be one of: Trivial, Minor, Standard, Major, Epic.

            Respond ONLY with a valid JSON object.

            Examples:
            Task: "Mow the lawn"
            Response: { "stat": "Strength", "tier": "Standard" }

            Task: "Read a chapter of a book"
            Response: { "stat": "Intelligence", "tier": "Standard" }
            
            Task: "Brush teeth"
            Response: { "stat": "Constitution", "tier": "Trivial" }

            Task: "Run a marathon"
            Response: { "stat": "Constitution", "tier": "Epic" }

            Now, classify the following user-submitted task.
            Task: "${choreText}"
            Response:
        `;

        // --- 3. Call the Vertex AI API ---
        const requestBody = {
            "instances": [{ "content": prompt }],
            "parameters": {
                "temperature": 0.2,
                "maxOutputTokens": 100,
                "topP": 0.95,
                "topK": 40
            }
        };

        const response = await axios.post(CLASSIFY_MODEL_ENDPOINT, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // --- 4. Parse the AI's Response ---
        // The AI's response is a string of JSON, so we need to find it and parse it.
        const aiResponseText = response.data.predictions[0].content;
        const jsonResponse = JSON.parse(aiResponseText.match(/\{.*\}/s)[0]);
        
        const { stat, tier } = jsonResponse;

        // --- 5. Convert Effort Tier to Stat Fragments ---
        // This maps the AI's text response to the fragment numbers our app uses.
        const effortMap = {
            'Trivial': 1,
            'Minor': 10,
            'Standard': 50,
            'Major': 250,
            'Epic': 1000
        };
        const effortValue = effortMap[tier] || 25; // Default to Standard if something goes wrong

        // --- 6. Send the Final Result to the App ---
        res.status(200).json({
            stat: stat.toLowerCase(), // Ensure stat is lowercase for consistency
            effort: effortValue
        });

    } catch (error) {
        console.error('ERROR:', error.response ? error.response.data : error.message);
        res.status(500).send(`Error processing chore: ${error.message}`);
    }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
