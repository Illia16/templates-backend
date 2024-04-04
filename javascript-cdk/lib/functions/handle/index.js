const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const { v4: uuidv4 } = require("uuid");

module.exports = async (event, context) => {
    const headers = event.headers;
    const allowedOrigins = ["http://localhost:3000", process.env.site_url_test, process.env.site_url_live];
    const headerOrigin = allowedOrigins.includes(headers?.origin) ? headers?.origin : null
    const action = event.httpMethod;

    // Environment variables
    const env = process.env.env;
    const projectName = process.env.projectName;
    // AWS Resource names
    const dbData = `${projectName}--myDB--${env}`;
    // Incoming data;
    const body = JSON.parse(event.body);
    const uniqueId = uuidv4();

    let response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": headerOrigin,
        },
        body: null,
    };

    if (action === 'GET') {
        const params = {
            TableName: dbData,
            ProjectionExpression: '#aliasItem, #aliasTime',
            ExpressionAttributeNames: {
              '#aliasItem': 'item',
              '#aliasTime': 'time',
            }
        };

        const command = new ScanCommand(params);
        const res = await docClient.send(command);
        response.body = JSON.stringify({success: true, data: res});
    }

    if (action === 'POST') {
        const input = {
            "RequestItems": {
              [dbData]: [{
                    PutRequest: {
                        Item: {
                            item: body.item,
                            time: new Date().toISOString() + "___" + uniqueId,
                        }
                    }
              }]
            }
        };

        const command = new BatchWriteCommand(input);
        const res = await client.send(command);
        response.body = JSON.stringify({success: true, data: res});
    }

    if (action === 'DELETE') {
        const input = {
            "RequestItems": {
              [dbData]: [{
                    DeleteRequest: {
                        Key: {
                            item: body.item,
                            time: body.time,
                        }
                    }
              }]
            }
        };

        const command = new BatchWriteCommand(input);
        const res = await client.send(command);
        response.body = JSON.stringify({success: true, data: res});
    }

    return response;
};
