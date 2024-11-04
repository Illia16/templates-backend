// websocketHandler.js
import { API_KEY_WS } from '../config.js';

let socket;
let connectionId;

const setupWebSocket = () => {
    const userNameButton = document.getElementById('userName');    
    if ((socket && socket?.readyState !== 3) || !userNameButton.value) return;

    connectionId = document.getElementById('connectionIdInput').value;
    socket = new WebSocket(API_KEY_WS + `?userName=${userNameButton.value}${connectionId ? `&connectionId=${connectionId}` : ''}`);

    socket.onopen = () => {
        console.log('Connected to WebSocket');
    };

    socket.onmessage = (event) => {
        console.log('Message from server:', event.data);
        const data = JSON.parse(event.data);

        if (data.newCount) {
            document.getElementById('incrementData').innerHTML = data.newCount;
        }

        // TODO
        if (data.createdConnectionId) {
            document.querySelector('#createdConnectionId strong').innerHTML = data.createdConnectionId;
            document.getElementById('#createdConnectionId').style.display = 'block';
        }
        // 
    };

    socket.onclose = () => {
        console.log('Disconnected from WebSocket');
    };
};

const handleIncrement = () => {
    const incrementValue = document.getElementById('incrementValue').value;
    if (isNaN(incrementValue)) {
        console.error('incrementValue must be a number', incrementValue)
        return
    }
    console.log('socket', socket);
    
    if (socket && socket.readyState === 1) {
        const message = {
            action: 'count',
            increment: Number(incrementValue) || 1,
            ...(connectionId ? { gameID: connectionId } : {}),
        };

        console.log('Sending message:', JSON.stringify(message));
        socket.send(JSON.stringify(message));
    } else {
        console.log('WebSocket is not connected');
    }
}

const handleDisconnect = () => {
    if (socket && socket.readyState === 1) {
        socket.close();
    } else {
        console.log('WebSocket is not connected');
    }
}

const connectButton = document.getElementById('connectWebSocket');
connectButton.addEventListener('click', setupWebSocket);

const incrementButton = document.getElementById('incrementCounter');
incrementButton.addEventListener('click', handleIncrement);


const disconnectButton = document.getElementById('disconnect');
disconnectButton.addEventListener('click', handleDisconnect);
