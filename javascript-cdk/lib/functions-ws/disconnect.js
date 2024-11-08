
// const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
// const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

module.exports.handler = async (event) => {
    // const client = new DynamoDBClient({});
    // const docClient = DynamoDBDocumentClient.from(client);

    // Uncomment below to delete instance by the one who created it
    // const command = new DeleteCommand({
    //     TableName: process.env.COUNTER_TABLE_NAME,
    //     Key: {
    //         connectionId: `tictactoe_${event.requestContext.connectionId}`,

    //     },
    // });
    
    // try {
    //     await docClient.send(command)
    // } catch (err) {
    //     console.log(err)
    //     return {
    //         statusCode: 500,
    //         body: JSON.stringify({ message: "Failed to disconnect" })
    //     };
    // }

    return {
        statusCode: 200,
    };
};
