
import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import time

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

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
        raise ValueError("Malformed JWT: expected 3 dot-separated parts")

    header = json.loads(decode_segment(parts[0]))
    payload = json.loads(decode_segment(parts[1]))

    # Do not accept algorithm substitution or unsigned tokens.
    if header.get("alg") != "HS256":
        raise ValueError(f"Unsupported JWT algorithm: {header.get('alg')}")

    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    expected_signature = hmac.new(
        get_jwt_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    actual_signature = decode_segment(parts[2])

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise ValueError("Invalid JWT signature: secret mismatch or corrupted token")

    now = int(time.time())

    if not isinstance(payload.get("exp"), (int, float)):
        raise TypeError("JWT expiry must be a number")

    if now >= payload["exp"]:
        raise ValueError(f"JWT has expired (exp: {payload['exp']}, now: {now})")

    if "nbf" in payload and now < payload["nbf"]:
        raise ValueError(f"JWT is not active yet (nbf: {payload['nbf']}, now: {now})")

    if not payload.get("id"):
        raise ValueError("JWT user ID is missing from payload ('id' claim)")

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
            logger.warning("[JWT Authorizer] Request rejected: missing or non-Bearer Authorization header")
            return {"isAuthorized": False}

        payload = verify_token(token)

        logger.info(f"[JWT Authorizer] Successfully authorized user: {payload.get('id')}")
        return {
            "isAuthorized": True,
            "context": {
                "user_id": str(payload["id"]),
            },
        }

    except Exception as e:
        # Log ERROR with exception and traceback to CloudWatch for observability,
        # while failing closed securely without returning internal details to caller.
        logger.error(
            f"[ERROR] [JWT Authorizer] Authorization failed with {type(e).__name__}: {e}",
            exc_info=True,
        )
        return {"isAuthorized": False}
