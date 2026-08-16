const WebSocket = require('ws');

// Запускаем сервер на порту 8080 (0.0.0.0 нужен, чтобы телефон в той же Wi-Fi сети мог подключиться к ПК)
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

const clients = {};        // Активные подключения: { username: ws }
const offlineMessages = {}; // Офлайн-сообщения: { username: [ messages... ] }
const usersDb = {};         // Простая память для паролей: { username: password }

wss.on('connection', (ws) => {
    let currentUsername = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
            if (data.type === 'LOGIN') {
                const { username, password } = data;
                
                if (!username || !password) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Заполните поля' }));
                    return;
                }

                // Проверяем пароль, если пользователь уже существовал
                if (usersDb[username] && usersDb[username] !== password) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Неверный пароль!' }));
                    return;
                }

                // Регистрируем, если новый
                if (!usersDb[username]) {
                    usersDb[username] = password;
                }

                // Запоминаем текущее подключение
                currentUsername = username;
                ws.username = username;
                clients[username] = ws;

                // Успешный вход
                ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username }));

                // ДОСТАВКА ОФЛАЙН-СООБЩЕНИЙ
                if (offlineMessages[username] && offlineMessages[username].length > 0) {
                    console.log(`Доставляем офлайн-сообщения для @${username} (${offlineMessages[username].length} шт.)`);
                    offlineMessages[username].forEach(msg => {
                        ws.send(JSON.stringify(msg));
                    });
                    offlineMessages[username] = []; // Очищаем после отправки
                }
            }

            // 2. ПОИСК ПОЛЬЗОВАТЕЛЯ
            if (data.type === 'SEARCH_USER') {
                const query = data.query ? data.query.trim() : '';
                // Пользователь считается существующим, если он есть в базе данных
                const found = !!usersDb[query];
                ws.send(JSON.stringify({ type: 'SEARCH_RESULT', found, username: query }));
            }

            // 3. ОТПРАВКА СООБЩЕНИЙ
            if (data.type === 'SEND_MESSAGE') {
                if (!currentUsername) return;

                const messagePayload = {
                    type: 'NEW_MESSAGE',
                    from: currentUsername,
                    to: data.recipient,
                    text: data.text,
                    isImage: data.isImage || false,
                    time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                // Отправляем получателю, если он онлайн
                if (clients[data.recipient] && clients[data.recipient].readyState === WebSocket.OPEN) {
                    clients[data.recipient].send(JSON.stringify(messagePayload));
                    console.log(`Сообщение от @${currentUsername} доставлено онлайн @${data.recipient}`);
                } else {
                    // Если получатель офлайн — сохраняем в массив
                    if (!offlineMessages[data.recipient]) {
                        offlineMessages[data.recipient] = [];
                    }
                    offlineMessages[data.recipient].push(messagePayload);
                    console.log(`@${data.recipient} офлайн. Сообщение сохранено.`);
                }

                // Дублируем отправителю, чтобы оно сразу появилось у него в интерфейсе
                ws.send(JSON.stringify(messagePayload));
            }

        } catch (e) {
            console.log('Ошибка при обработке сообщения:', e);
        }
    });

    ws.on('close', () => {
        if (currentUsername && clients[currentUsername] === ws) {
            delete clients[currentUsername];
            console.log(`Пользователь @${currentUsername} отключился (офлайн)`);
        }
    });
});

console.log('🚀 Сервер запущен и слушает порт 8080');
