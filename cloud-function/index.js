const express = require('express');
const cors = require('cors');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Initialize Vertex AI
const vertex_ai = new VertexAI({
    project: 'codex-vitae-470801', // Your Project ID
    location: 'us-central1'
});

const generativeModel = vertex_ai.getGenerativeModel({
    model: 'imagegeneration@006',
});

// Define the function endpoint
app.post('/', async (req, res) => {
    if (!req.body.image) {
        return res.status(400).send('No image data provided.');
    }

    try {
        const file = {
            inlineData: {
                data: req.body.image,
                mimeType: 'image/jpeg',
            },
        };

        const prompt = "A beautiful, Ghibli-inspired digital painting of the person, rpg fantasy character portrait, cinematic, stunning";
        const request = {
            prompt,
            image: file,
            sampleCount: 1,
            editConfig: {
                editMode: "STYLE_TRANSFER"
            }
        };

        const response = await generativeModel.editImage(request);
        const imageBase64 = response[0].image.bytesValue.toString('base64');
        
        res.status(200).json({ base64Image: imageBase64 });

    } catch (error) {
        console.error('ERROR:', error);
        res.status(500).send(`Error processing image: ${error.message}`);
    }
});

exports.generateAvatar = app;
