const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running\n');
});

// Увеличенный лимит (10 МБ) предотвращает падение сервера при отправке фото
const wss = new WebSocket.Server({ server, maxPayload: 10 * 1024 * 1024 });

const users = {}; 
const clients = {}; 

wss.on('connection', (ws) => {
    let currentUsername = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'LOGIN') {
                const { username, password } = data;
                if (!username || !password) return;

                if (users[username]) {
                    if (users[username] === password) {
                        currentUsername = username;
                        clients[username] = ws;
                        ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                    } else {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Неверный пароль!' }));
                    }
                } else {
                    users[username] = password;
                    currentUsername = username;
                    clients[username] = ws;
                    ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                }
            }

            if (data.type === 'SEARCH_USER') {
                const query = data.query.replace('@', '').trim();
                if (users[query]) {
                    ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found: true, username: query }));
                } else {
                    ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found: false }));
                }
            }

            if (data.type === 'SEND_MESSAGE') {
                if (!currentUsername) return;
                
                const { recipient, text, isImage } = data;
                if (!recipient || text === undefined) return;

                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const messagePayload = JSON.stringify({
                    type: 'NEW_MESSAGE',
                    from: currentUsername,
                    to: recipient,
                    text: text,
                    time: time,
                    isImage: !!isImage
                });

                if (clients[recipient]) {
                    clients[recipient].send(messagePayload);
                }

                if (clients[currentUsername]) {
                    clients[currentUsername].send(messagePayload);
                }
            }

        } catch (e) {
            console.error('Ошибка:', e);
        }
    });

    ws.on('close', () => {
        if (currentUsername && clients[currentUsername]) {
            delete clients[currentUsername];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
