const cors = require('cors')({ origin: true });  // Permite qualquer origem
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

// Função que será chamada quando o usuário acessar a API
exports.avatarGeneration = (req, res) => {
    // Habilitar o CORS
    cors(req, res, async () => {
        // Caso a requisição seja OPTIONS, apenas retorna um 200 para passar o pré-vôo (preflight)
        if (req.method === 'OPTIONS') {
            return res.status(200).send('Preflight passed');
        }

        // Verificar se a imagem foi passada
        if (!req.body.image) {
            return res.status(400).send('No image data provided.');
        }

        // Autenticação com Google Cloud
        try {
            const auth = new GoogleAuth({
                scopes: 'https://www.googleapis.com/auth/cloud-platform'
            });
            const client = await auth.getClient();
            const accessToken = (await client.getAccessToken()).token;

            // Dados da requisição que será enviada para o modelo AI
            const requestBody = {
                "instances": [{
                    "prompt": "A beautiful, Ghibli-inspired digital painting of the person, rpg fantasy character portrait, cinematic, stunning",
                    "image": { "bytesBase64Encoded": req.body.image }
                }]
            };

            // Endpoint do modelo AI no Google Cloud AI
            const PROJECT_ID = 'codex-vitae-470801';
            const LOCATION = 'us-east1';
            const MODEL_ID = 'imagegeneration@006';
            const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com`;
            const MODEL_ENDPOINT_URL = `${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict`;

            // Enviar a requisição para gerar o avatar
            const response = await axios.post(MODEL_ENDPOINT_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // Obter a imagem em base64 do modelo
            const imageBase64 = response.data.predictions[0].bytesBase64Encoded;

            // Enviar a resposta com a imagem gerada
            res.status(200).json({ base64Image: imageBase64 });

        } catch (error) {
            console.error('ERROR:', error.response ? error.response.data : error.message);
            res.status(500).send(`Error processing image: ${error.message}`);
        }
    });
};
