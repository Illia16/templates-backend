const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

module.exports.handler = async (event) => {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: {
            removeUndefinedValues: true,
            convertClassInstanceToMap: true,
        }
    });
    console.log("Received event:", JSON.stringify(event));

    const userName = event.queryStringParameters?.userName;
    const existingConnection = event.queryStringParameters?.connectionId;
    const connectionId = existingConnection 
        ? existingConnection 
        : `tictactoe_${event.requestContext.connectionId}`;

    try {
        if (existingConnection) {
            // Update existing connection with a new user
            const updateCommand = new UpdateCommand({
                TableName: process.env.COUNTER_TABLE_NAME,
                Key: { connectionId },
                UpdateExpression: "SET userList.#userId = :userName",
                ExpressionAttributeNames: {
                    "#userId": event.requestContext.connectionId
                },
                ExpressionAttributeValues: {
                    ":userName": userName
                }
            });
            await docClient.send(updateCommand);
        } else {
            // Create a new connection with the initial user
            const putCommand = new PutCommand({
                TableName: process.env.COUNTER_TABLE_NAME,
                Item: {
                    connectionId,
                    userList: {
                        [event.requestContext.connectionId]: userName,
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
