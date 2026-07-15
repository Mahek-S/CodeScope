"""
Webhook signature verification for GitHub events.
GitHub signs the payload with HMAC-SHA256 using the webhook secret.
"""

import hashlib
import hmac


def verify_github_signature(payload_body: bytes, secret: str, signature_header: str) -> bool:
    """
    Verify that the X-Hub-Signature-256 header matches the payload.

    Args:
        payload:          Raw request body bytes
        secret:           Webhook secret configured in GitHub
        signature_header: Value of the X-Hub-Signature-256 header

    Returns:
        True if signature is valid, False otherwise
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(secret.encode(), payload_body, hashlib.sha256).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
