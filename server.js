const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище пользователей и активных клиентов { username: ws }
const users = {
    "test": "test" // Можешь добавить базового пользователя для проверки
};
const clients = new Map();

// Явно отдаем index.html при заходе на сайт
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка WebSocket подключений
wss.on('connection', (ws) => {
    let currentUsername = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Обработка входа / регистрации
            if (data.type === 'LOGIN') {
                const { username, password } = data;
                if (!username || !password) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Заполните все поля!' }));
                    return;
                }

                if (users[username]) {
                    if (users[username] === password) {
                        currentUsername = username;
                        clients.set(username, ws);
                        ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                    } else {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Неверный пароль!' }));
                    }
                } else {
                    // Регистрация нового пользователя
                    users[username] = password;
                    currentUsername = username;
                    clients.set(username, ws);
                    ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                }
            }

            // Поиск пользователя по username
            if (data.type === 'SEARCH_USER') {
                const query = data.query.replace('@', '').trim();
                const exists = users.hasOwnProperty(query);
                ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found: exists, username: query }));
            }

            // Отправка личного сообщения
            if (data.type === 'SEND_MESSAGE') {
                if (!currentUsername) return;
                const { recipient, text } = data;
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const messagePayload = {
                    type: 'NEW_MESSAGE',
                    from: currentUsername,
                    to: recipient,
                    text: text,
                    time: time
                };

                // Отправляем получателю, если он онлайн
                const recipientWs = clients.get(recipient);
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messagePayload));
                }

                // Отправляем обратно отправителю, чтобы у него тоже отобразилось
                ws.send(JSON.stringify(messagePayload));
            }

        } catch (err) {
            console.error("Ошибка обработки сообщения:", err);
        }
    });

    ws.on('close', () => {
        if (currentUsername) {
            clients.delete(currentUsername);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
