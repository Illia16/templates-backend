const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

module.exports.handler = async (event) => {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const apiGatewayClient = new ApiGatewayManagementApiClient({
        endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });
    console.log("Received event:", JSON.stringify(event));

    const body = JSON.parse(event.body);
    const incrementValue = body.increment || 1;
    const gameID = body.gameID;

    const command = new UpdateCommand({
        TableName: process.env.COUNTER_TABLE_NAME,
        Key: {
            connectionId: gameID,
        },
        UpdateExpression: `
            SET #c = if_not_exists(#c, :start) + :increment,
                userList.#userId.#score = if_not_exists(userList.#userId.#score, :initialScore) + :increment
        `,
        ExpressionAttributeNames: {
            "#c": "count",
            "#userId": event.requestContext.connectionId,
            "#score": "score",
        },
        ExpressionAttributeValues: {
            ":start": 0,
            ":increment": incrementValue,
            ":initialScore": 0,
        },
        ReturnValues: "ALL_NEW"
    });

    try {
        const result = await docClient.send(command);

        const updatedCount = result.Attributes.count;
        const updatedData = result.Attributes.userList;
        const connectionIds = Object.keys(result.Attributes.userList)

        // Send updated data to all clients
        const postCalls = [...connectionIds].map(connectionId => {
            const params = {
                ConnectionId: connectionId,
                Data: JSON.stringify({ message: "Counter updated", newCount: updatedCount, userList: updatedData })
            };
            return apiGatewayClient.send(new PostToConnectionCommand(params));
        });
        await Promise.all(postCalls);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Counter incremented", newCount: result.Attributes.count, userList: updatedData })
        };
    } catch (err) {
        console.error("Error updating counter:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to update counter" })
        };
    } 
};
