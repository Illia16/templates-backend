const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

module.exports.handler = async (event) => {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    console.log("Received event:", JSON.stringify(event));

    const userName = event.queryStringParameters?.userName;
    const joinExistingConnection = event.queryStringParameters?.gameID;
    const gameID = joinExistingConnection 
        ? joinExistingConnection 
        : `tictactoe_${event.requestContext.connectionId}`;

    try {
        if (joinExistingConnection) {
            // Update existing connection with a new user
            const updateCommand = new UpdateCommand({
                TableName: process.env.COUNTER_TABLE_NAME,
                Key: { connectionId: gameID },
                UpdateExpression: "SET userList.#userId = :userData",
                ExpressionAttributeNames: {
                    "#userId": event.requestContext.connectionId
                },
                ExpressionAttributeValues: {
                    ":userData": {
                        userName: userName,
                        score: 0,
                    }
                }
            });
            await docClient.send(updateCommand);
        } else {
            // Create a new connection with the initial user
            const putCommand = new PutCommand({
                TableName: process.env.COUNTER_TABLE_NAME,
                Item: {
                    connectionId: gameID,
                    userList: {
                        [event.requestContext.connectionId]: {
                            userName: userName,
                            score: 0
                        }
                    }
                }
            });
            await docClient.send(putCommand);
        }
    } catch (err) {
        console.log("Error:", err);
        return {
            statusCode: 500,
        };
    }

    return {
        statusCode: 200,
    };
};
