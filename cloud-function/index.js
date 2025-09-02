const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const app = express();

// Habilitar CORS para todas as origens ou uma origem específica
const corsOptions = {
    origin: '*',  // Permitir todas as origens (pode ser substituído por sua URL específica em produção)
    methods: 'POST, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization'
};
app.use(cors(corsOptions));  // Aplica CORS a todas as rotas
app.use(express.json({ limit: '10mb' }));

const PROJECT_ID = 'codex-vitae-470801';
const LOCATION = 'us-east1'; 
const MODEL_ID = 'imagegeneration@006';

const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com`;
const MODEL_ENDPOINT_URL = `${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict`;

app.post('/', async (req, res) => {
    // Configurar CORS na resposta, se necessário
    res.set('Access-Control-Allow-Origin', '*');  // Permite todas as origens (ou substitua pela URL do seu frontend)
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Verificar se a imagem foi enviada na requisição
    if (!req.body.image) {
        return res.status(400).send('No image data provided.');
    }

    try {
        // Autenticação com Google Cloud
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        // Montar o corpo da requisição para o modelo de AI
        const requestBody = {
            "instances": [{
                "prompt": "A beautiful, Ghibli-inspired digital painting of the person, rpg fantasy character portrait, cinematic, stunning",
                "image": { "bytesBase64Encoded": req.body.image }
            }]
        };

        // Enviar a requisição para o modelo de AI no Google Cloud
        const response = await axios.post(MODEL_ENDPOINT_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Extrair a imagem gerada pelo modelo
        const imageBase64 = response.data.predictions[0].bytesBase64Encoded;

        // Enviar a imagem gerada de volta ao frontend
        res.status(200).json({ base64Image: imageBase64 });

    } catch (error) {
        console.error('ERROR:', error.response ? error.response.data : error.message);
        res.status(500).send(`Error processing image: ${error.message}`);
    }
});

// Iniciar o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
