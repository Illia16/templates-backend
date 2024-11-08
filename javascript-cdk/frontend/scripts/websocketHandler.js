import { API_KEY_WS } from '../config.js';

let socket;
let gameID;

// TODO:
// Upon succesfull connection save (in localStorage) connectionId, userID, userName so that can rejoin.
// Clear it if/when user disconnects

const setupWebSocket = () => {
    const userNameButton = document.getElementById('userName');    
    if ((socket && socket?.readyState !== 3) || !userNameButton.value) return;

    gameID = document.getElementById('connectionIdInput').value;
    socket = new WebSocket(API_KEY_WS + `?userName=${userNameButton.value}${gameID ? `&gameID=${gameID}` : ''}`);

    socket.onopen = (event) => {
        console.log('Connected to WebSocket', event);

        // The one who "created" connection, gets ID to share with others
        if (!gameID) {
            handleDefaultRoute();
        }
    };

    socket.onmessage = (event) => {
        console.log('Message from server:', event.data);
        const data = JSON.parse(event.data);

        if (data.newCount) {
            document.getElementById('incrementData').innerHTML = data.newCount;

            if (data.userList) {
                console.log('data.userList', data.userList);
                
                const userData = data.userList;
                // Update scores for every user
                const userScoresDiv = document.getElementById('userScores');
                userScoresDiv.innerHTML = '';
                
                for (const key in userData) {
                    if (userData.hasOwnProperty(key)) {
                        const user = userData[key];
                        const userDiv = document.createElement('div');
                        userDiv.textContent = `${user.userName}: ${user.score}`;
                        userScoresDiv.appendChild(userDiv);
                    }
                }
                // 
            }
        }

        if (data.createdConnectionId) {
            document.querySelector('#createdConnectionId strong').innerHTML = data.createdConnectionId;
            document.getElementById('createdConnectionId').style.display = 'block';
            gameID = data.createdConnectionId;
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
    
    if (socket && socket.readyState === 1) {
        const message = {
            action: 'count',
            increment: Number(incrementValue) || 1,
            gameID: gameID,
        };

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

const handleDefaultRoute = () => {
    if (socket && socket.readyState === 1) {
        const message = {
            action: 'dummyRoute',
        };
        console.log('Sending message to default route', JSON.stringify(message));
        socket.send(JSON.stringify(message));
    }
}

const connectButton = document.getElementById('connectWebSocket');
connectButton.addEventListener('click', setupWebSocket);

const incrementButton = document.getElementById('incrementCounter');
incrementButton.addEventListener('click', handleIncrement);


const disconnectButton = document.getElementById('disconnect');
disconnectButton.addEventListener('click', handleDisconnect);
