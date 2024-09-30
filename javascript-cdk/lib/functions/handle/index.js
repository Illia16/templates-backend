const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const { v4: uuidv4 } = require("uuid");
const helpers = require('../helpers')

module.exports.handler = async (event, context) => {

    // Environment variables
    const STAGE = process.env.STAGE;
    const PROJECT_NAME = process.env.PROJECT_NAME;
    const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
    
    const headers = event.headers;
    const allowedOrigins = ["http://localhost:3000", CLOUDFRONT_URL];
    const headerOrigin = allowedOrigins.includes(headers?.origin) ? headers?.origin : null
    const action = event.httpMethod;    

    // AWS Resource names
    const dbData = `${PROJECT_NAME}--myDB--${STAGE}`;
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

        try {
            const res = await docClient.send(command);
            response.body = JSON.stringify({success: true, data: res.Items});
        } catch (error) {
            response.body = JSON.stringify({success: false, error: error});
        }
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
        try {
            const res = await docClient.send(command);
            response.body = JSON.stringify({success: true, data: res});
        } catch (error) {
            response.body = JSON.stringify({success: false, error: error});

        }
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

        try {
            const res = await docClient.send(command);
            response.body = JSON.stringify({success: true, data: res});
        } catch (error) {
            response.body = JSON.stringify({success: false, error: error});
        }
    }

    if (body?.email) {
        await helpers.sendEmail({email: body.email, subject: body.subject, message: body.message});
    }

    return response;
};
