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
    const gameID = body.gameID || `tictactoe_${event.requestContext.connectionId}`;

    const command = new UpdateCommand({
        TableName: process.env.COUNTER_TABLE_NAME,
        Key: {
            connectionId: gameID,
        },
        UpdateExpression: "SET #c = if_not_exists(#c, :start) + :increment",
        ExpressionAttributeNames: {
            "#c": "count",
        },
        ExpressionAttributeValues: {
            ":start": 0,
            ":increment": incrementValue,
        },
        ReturnValues: "ALL_NEW"
    });

    try {
        const result = await docClient.send(command);

        const updatedCount = result.Attributes.count;
        const connectionIds = Object.keys(result.Attributes.userList)

        // Send updated data to all clients
        const postCalls = [...connectionIds].map(connectionId => {
            const params = {
                ConnectionId: connectionId,
                Data: JSON.stringify({ message: "Counter updated", newCount: updatedCount })
            };
            return apiGatewayClient.send(new PostToConnectionCommand(params));
        });
        await Promise.all(postCalls);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Counter incremented", newCount: result.Attributes.count })
        };
    } catch (err) {
        console.error("Error updating counter:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to update counter" })
        };
    } 
};
