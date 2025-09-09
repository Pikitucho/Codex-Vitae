const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");

const app = express();
// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

// --- CONFIGURATION ---
const PROJECT_ID = "codex-vitae-app";
const LOCATION = "us-central1";
const CLASSIFY_MODEL_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-1.0-pro:predict`;

// --- Chore Classification Endpoint ---
app.post("/classify-chore", async (req, res) => {
    if (!req.body.text) {
        return res.status(400).send("Bad Request: No chore text provided.");
    }
    const choreText = req.body.text;

    try {
        const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        const prompt = `
            You are a game designer for a life-gamification app. Classify the user's chore into a "Stat" and an "Effort Tier".
            The "Stat" must be one of: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.
            The "Effort Tier" must be one of: Trivial, Minor, Standard, Major, Epic.
            Respond ONLY with a valid JSON object.
            Examples:
            Task: "Mow the lawn" -> Response: { "stat": "Strength", "tier": "Standard" }
            Task: "Brush teeth" -> Response: { "stat": "Constitution", "tier": "Trivial" }
            Now, classify this task.
            Task: "${choreText}"
            Response:
        `;

        const requestBody = {
            instances: [{ content: prompt }],
            parameters: { temperature: 0.2, maxOutputTokens: 100, topP: 0.95, topK: 40 },
        };

        const response = await axios.post(CLASSIFY_MODEL_ENDPOINT, requestBody, {
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });
        
        const aiResponseText = response.data.predictions[0].content;
        const jsonResponse = JSON.parse(aiResponseText.match(/\{.*\}/s)[0]);
        const { stat, tier }. = jsonResponse;

        const effortMap = { Trivial: 1, Minor: 10, Standard: 50, Major: 250, Epic: 1000 };
        const effortValue = effortMap[tier] || 50;

        res.status(200).json({
            stat: stat.toLowerCase(),
            effort: effortValue,
        });

    } catch (error) {
        console.error("ERROR:", error.response ? error.response.data : error.message);
        res.status(500).send(`Error processing chore: ${error.message}`);
    }
});

// Expose the Express API as a single Cloud Function named "api"
exports.api = functions.https.onRequest(app);
