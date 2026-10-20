
import base64
import hashlib
import hmac
import json
import os
import time

import boto3

secrets_client = boto3.client("secretsmanager")
SECRET_ARN = os.environ["JWT_SECRET_ARN"]

_cached_secret = None


def get_jwt_secret():
    """Retrieve the existing backend JWT secret from Secrets Manager."""
    global _cached_secret

    if _cached_secret is None:
        response = secrets_client.get_secret_value(SecretId=SECRET_ARN)
        secret_string = response["SecretString"]

        # AWS key/value secrets are commonly stored as JSON.
        try:
            parsed = json.loads(secret_string)
            if isinstance(parsed, dict) and "JWT_SECRET" in parsed:
                _cached_secret = parsed["JWT_SECRET"]
            else:
                _cached_secret = secret_string
        except json.JSONDecodeError:
            _cached_secret = secret_string

        if not isinstance(_cached_secret, str) or not _cached_secret:
            raise ValueError("JWT secret is empty or invalid")

    return _cached_secret


def decode_segment(segment):
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def verify_token(token):
    """Verify an HS256 JWT signature and its expiry."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT")

    header = json.loads(decode_segment(parts[0]))
    payload = json.loads(decode_segment(parts[1]))

    # Do not accept algorithm substitution or unsigned tokens.
    if header.get("alg") != "HS256":
        raise ValueError("Unsupported JWT algorithm")

    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    expected_signature = hmac.new(
        get_jwt_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    actual_signature = decode_segment(parts[2])

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise ValueError("Invalid JWT signature")

    now = int(time.time())

    if not isinstance(payload.get("exp"), (int, float)):
        raise ValueError("JWT expiry is missing")

    if now >= payload["exp"]:
        raise ValueError("JWT has expired")

    if "nbf" in payload and now < payload["nbf"]:
        raise ValueError("JWT is not active yet")

    if not payload.get("id"):
        raise ValueError("JWT user ID is missing")

    return payload


def lambda_handler(event, context):
    """API Gateway HTTP API Lambda authorizer, payload format 2.0."""
    try:
        authorization = (
            event.get("headers", {}).get("authorization")
            or event.get("headers", {}).get("Authorization")
            or ""
        )

        scheme, separator, token = authorization.partition(" ")

        if not separator or scheme.lower() != "bearer" or not token:
            return {"isAuthorized": False}

        payload = verify_token(token)

        return {
            "isAuthorized": True,
            "context": {
                "user_id": str(payload["id"]),
            },
        }

    except Exception:
        # Fail closed. Do not return token, secret, or exception details.
        return {"isAuthorized": False}
