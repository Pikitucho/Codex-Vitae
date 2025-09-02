// index.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Usando CORS para permitir requisições de 'https://pikitucho.github.io'
app.use(cors({
  origin: 'https://pikitucho.github.io', // Permite apenas essa origem
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware para tratar JSON
app.use(express.json());

// Rota para gerar o avatar
app.post('/generate-avatar', async (req, res) => {
  try {
    const { image } = req.body;  // O corpo da requisição contém a imagem em base64
    
    // Suponha que você envie a imagem para um serviço de geração de avatar
    const response = await axios.post('https://api.exemplo.com/generate-avatar', {
      image,  // Passa a imagem para a API externa
    });

    // Aqui, você retorna a imagem gerada para o cliente
    res.status(200).json({
      avatar: response.data.avatar,  // Avatar gerado em base64 ou outra resposta da API
    });

  } catch (error) {
    console.error('Erro ao gerar o avatar:', error);
    res.status(500).send('Erro ao gerar o avatar: ' + error.message);
  }
});

// Inicializando o servidor
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
