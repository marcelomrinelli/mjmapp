require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./bot');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Webhook de Twilio para mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res) => {
  const from = req.body.From;   // ej: "whatsapp:+5491112345678"
  const body = req.body.Body?.trim();

  if (!from || !body) {
    return res.status(400).send('Bad Request');
  }

  try {
    const twiml = await handleIncomingMessage(from, body);
    res.type('text/xml').send(twiml);
  } catch (err) {
    console.error('Error procesando mensaje:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot Cecilia escuchando en puerto ${PORT}`));
