const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
console.log('Сервер запущен на ws://localhost:8080');

const users = {}; // База пользователей: { username: { password, socket } }

wss.on('connection', (ws) => {
    let currentUsername = null;

    ws.on('message', (rawData) => {
        try {
            const data = JSON.parse(rawData);

            // Вход или регистрация
            if (data.type === 'LOGIN') {
                const { username, password } = data;
                
                if (users[username]) {
                    if (users[username].password === password) {
                        users[username].socket = ws;
                        currentUsername = username;
                        ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                    } else {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Неверный пароль!' }));
                    }
                } else {
                    users[username] = { password, socket: ws };
                    currentUsername = username;
                    ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));
                }
            }

            // Поиск пользователя
            if (data.type === 'SEARCH_USER') {
                const target = data.query.trim();
                if (users[target]) {
                    ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found: true, username: target }));
                } else {
                    ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found: false }));
                }
            }

            // Отправка сообщения
            if (data.type === 'SEND_MESSAGE') {
                const { recipient, text } = data;
                const msgData = {
                    type: 'NEW_MESSAGE',
                    from: currentUsername,
                    to: recipient,
                    text,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                if (users[recipient] && users[recipient].socket) {
                    users[recipient].socket.send(JSON.stringify(msgData));
                }
                ws.send(JSON.stringify(msgData));
            }
        } catch (e) {
            console.error('Ошибка:', e);
        }
    });

    ws.on('close', () => {
        if (currentUsername && users[currentUsername]) {
            users[currentUsername].socket = null;
        }
    });
});