const clients = {}; // { username: ws_connection }
const offlineMessages = {}; // { username: [ {from, to, text, isImage, time} ] }

// Внутри обработки входящих сообщений:
ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'LOGIN') {
        clients[data.username] = ws;
        ws.username = data.username;
        
        ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', username: data.username }));

        // Отправляем все накопленные офлайн-сообщения
        if (offlineMessages[data.username] && offlineMessages[data.username].length > 0) {
            offlineMessages[data.username].forEach(msg => {
                ws.send(JSON.stringify({ type: 'NEW_MESSAGE', ...msg }));
            });
            offlineMessages[data.username] = []; // Очищаем после отправки
        }
    }

    if (data.type === 'SEND_MESSAGE') {
        const messagePayload = {
            type: 'NEW_MESSAGE',
            from: ws.username,
            to: data.recipient,
            text: data.text,
            isImage: data.isImage,
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Отправляем получателю, если он онлайн
        if (clients[data.recipient] && clients[data.recipient].readyState === WebSocket.OPEN) {
            clients[data.recipient].send(JSON.stringify(messagePayload));
        } else {
            // Если получатель офлайн, сохраняем сообщение
            if (!offlineMessages[data.recipient]) {
                offlineMessages[data.recipient] = [];
            }
            offlineMessages[data.recipient].push(messagePayload);
        }

        // Обязательно дублируем сообщение обратно отправителю, чтобы оно отобразилось у него в чате
        ws.send(JSON.stringify(messagePayload));
    }
});
