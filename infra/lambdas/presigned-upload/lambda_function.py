import json
import os
import boto3

s3_client = boto3.client("s3")

BUCKET_NAME = os.environ["BUCKET_NAME"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Content-Type": "application/json",
}


def lambda_handler(event, context):
    body = json.loads(event.get("body", "{}"))

    file_name = body.get("file_name")
    content_type = body.get("content_type")

    if not file_name or not content_type:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "error": "file_name and content_type are required"
            })
        }

    object_key = f"evidence/{file_name}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type
        },
        ExpiresIn=900
    )

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "upload_url": presigned_url,
            "object_key": object_key,
            "expires_in": 900
        })
    }
