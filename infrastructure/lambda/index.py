import json
import os
import time
import uuid

import boto3

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

    if method == "POST":
        payload = json.loads(event.get("body") or "{}")
        item = {
            "id": str(uuid.uuid4()),
            "data": payload,
            "created_at": int(time.time()),
            "expires_at": int(time.time()) + 30 * 24 * 3600,
        }
        table.put_item(Item=item)
        return _resp(201, {"id": item["id"]})

    result = table.scan(Limit=25)
    return _resp(200, {"items": result.get("Items", []), "count": result["Count"]})