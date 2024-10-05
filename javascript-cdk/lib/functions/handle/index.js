const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const { v4: uuidv4 } = require("uuid");
const helpers = require('../helpers');
const multipartParser = require('parse-multipart-data');

module.exports.handler = async (event, context) => {
    // Environment variables
    const STAGE = process.env.STAGE;
    const PROJECT_NAME = process.env.PROJECT_NAME;
    const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
    
    const headers = event.headers;
    const allowedOrigins = ["http://localhost:3000", CLOUDFRONT_URL];
    const headerOrigin = allowedOrigins.includes(headers?.origin) ? headers?.origin : null;
    const action = event.httpMethod;
    const isBase64Encoded = event.isBase64Encoded;

    // AWS Resource names
    const dbData = `${PROJECT_NAME}--myDB--${STAGE}`;
    const s3Bucket = `${process.env.PROJECT_NAME}--s3-site--${process.env.STAGE}`;

    let response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": headerOrigin,
        },
        body: null,
    };

    // Incoming data;
    let body;
    if (!isBase64Encoded) {
        body = JSON.parse(event.body);
    } else {
        const contentType = headers['Content-Type'] || headers['content-type'];
        const boundary = contentType.split('boundary=')[1];

        const getRawData = Buffer.from(event.body, 'base64');
        const parsedData = multipartParser.parse(getRawData, boundary);
        body = parsedData.reduce(function (result, currentObject) {
            if (currentObject.name !== 'file') {
                result[currentObject.name] = currentObject.data.toString('utf8');
            } else {
                result.file = [{
                    name: currentObject.name,
                    filename: currentObject.filename,
                    type: currentObject.type,
                    data: currentObject.data,
                    size: currentObject.data.length,
                }];
            }

            return result;
        }, {});
    }
    const uniqueId = uuidv4();

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
        // There's 3 scenarios:
        // 1) Email with no attachment.
        // 2) Email with attachment that's less than 5 Mb.
        // 3) Email with attachment that's larger than 5 Mb.
        //     3.1) Generate presign url and return it to FrontEnd
        //     3.2) On FrontEnd, upload a file using the pre-sign url
        //     3.3) Call the same api again passing "fileAsUrl". Get URL of the uploaded file from the S3 bucket and send it via email 
        if (body.fileAsUrl) {
            const fileUrl = await helpers.s3GetSignedUrl(s3Bucket, `files/${body.largeFilename}`);
            await helpers.sendEmailLargeAttachment({email: body.email, subject: body.subject, message: body.message, fileUrl: fileUrl});
            response.body = JSON.stringify({success: true});
        } else {
            const file = body?.file?.[0];
            // No attachment
            if (!file && !body.largeFilename) {
                await helpers.sendEmailSmallAttachment({email: body.email, subject: body.subject, message: body.message});
                response.body = JSON.stringify({success: true, data: null});
            } else if (file?.size < 5242880) {
                // Attachment, but less than 5 Mb
                await helpers.sendEmailSmallAttachment({email: body.email, subject: body.subject, message: body.message, file: file});
                response.body = JSON.stringify({success: true, data: null});
            } else {
                // Attachment, but it's large so create presign url, return to frontend
                const presignedData = await helpers.s3PostSignedUrl(
                    s3Bucket, 
                    // `files/${file.filename}`,
                    `files/${body.largeFilename}`,
                    [{ bucket: s3Bucket }, ["starts-with", "$key", "files"]]
                );
                response.body = JSON.stringify({success: true, data: presignedData});
            }
        }
    }

    return response;
};
