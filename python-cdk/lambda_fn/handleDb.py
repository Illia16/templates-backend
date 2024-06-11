import json
import os
from datetime import datetime
import uuid
import boto3
from dynamodb_json import json_util as dynamodb_output_handle

def lambda_db_handler(event, context):
    # Environment variables
    env = os.environ.get('env')
    projectName = os.environ.get('projectName')
    site_url_test = os.environ.get('site_url_test')
    site_url_live = os.environ.get('site_url_live')
    # AWS Resource names
    dbData = f'{projectName}--myDB--{env}'
    # Init DB
    dynamodb = boto3.client('dynamodb')
    # Incoming data
    body = {} if event.get("body") is None else json.loads(event["body"])
    # Helpers
    uniqueId = uuid.uuid4()

    # Other data
    headers = event.get("headers", {})
    allowed_origins = ["http://localhost:3000", site_url_test, site_url_live]
    header_origin = headers.get("origin") if headers.get("origin") in allowed_origins else None
    action = event.get("httpMethod")

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": header_origin,
        },
        "body": None,
    }

    data = []
    if action == 'GET':
        params = {
            'TableName': dbData,
            'ProjectionExpression': '#aliasItem, #aliasTime',
            'ExpressionAttributeNames': {
                '#aliasItem': 'item',
                '#aliasTime': 'time'
            }
        }

        res = dynamodb.scan(**params)
        dynamodb_output_handle.loads(res)
        data = res

    if action == 'POST':
        input = {
            "RequestItems": {
                dbData: [{
                    'PutRequest': {
                        'Item': {
                            'item': {'S': body['item']},
                            'time': {'S': f"{datetime.now().isoformat()}___{uniqueId}"}
                        }
                    }
                }]
            }
        }

        res = dynamodb.batch_write_item(**input)
        data = res

    if action == 'DELETE':
        input = {
            "RequestItems": {
                dbData: [{
                    'DeleteRequest': {
                        'Key': {
                            'item': {'S': body['item']},
                            'time': {'S': body['time']}
                        }
                    }
                }]
            }
        }

        res = dynamodb.batch_write_item(**input)
        data = res

    response["body"] = json.dumps({'success': True, 'data': data})
    return response

# todo: unmarshall response for boto3