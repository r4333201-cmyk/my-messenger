const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Раздаем статические файлы (включая index.html)
app.use(express.static(path.join(__dirname)));

// Обработка WebSocket подключений
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Пересылаем сообщение всем подключенным клиентам
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });
});

// Порт для Render или локального запуска
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});