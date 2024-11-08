const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

module.exports.handler = async (event) => {
    const apiGatewayClient = new ApiGatewayManagementApiClient({
        endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });

    const params = {
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify({ message: "Default route called", createdConnectionId: `tictactoe_${event.requestContext.connectionId}` })
    };
    await apiGatewayClient.send(new PostToConnectionCommand(params));

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Default route" })
    };
};
