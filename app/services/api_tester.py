import json
import re
import time

import requests as http_requests

from app.extensions import db
from app.models.api_test import ApiTest
from app.models.threshold import Threshold
from app.services.ssrf import is_private_url


def _url_matches_pattern(url: str, pattern: str) -> bool:
    """Match a URL against a SQL LIKE-style pattern (% as wildcard)."""
    regex = "^" + re.escape(pattern).replace(r"\%", ".*").replace(r"\_", ".") + "$"
    return bool(re.match(regex, url))


def get_threshold_for_url(url: str, default_ms: float) -> float:
    """Find the most specific threshold matching a URL."""
    thresholds = Threshold.query.order_by(
        db.func.length(Threshold.url_pattern).desc()
    ).all()
    for t in thresholds:
        if _url_matches_pattern(url, t.url_pattern):
            return t.max_response_time_ms
    return default_ms


def execute_api_test(
    url: str,
    method: str,
    headers: dict,
    body,
    collection: str,
    timeout_sec: int,
    default_threshold_ms: float,
) -> dict:
    """Execute an API test request and store the result."""

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    if is_private_url(url):
        return {"error": "Requests to private/internal networks are not allowed"}, 403

    # Parse body for methods that support it
    parsed_body = None
    if body and method in ("POST", "PUT", "PATCH", "DELETE"):
        if isinstance(body, str):
            try:
                parsed_body = json.loads(body)
            except json.JSONDecodeError:
                parsed_body = body
        else:
            parsed_body = body

    error = None
    status_code = None
    response_body = None
    response_headers = None
    response_time_ms = 0.0

    try:
        start = time.perf_counter()
        kwargs = {"headers": headers, "timeout": timeout_sec}

        if method == "GET":
            resp = http_requests.get(url, **kwargs)
        elif method in ("POST", "PUT", "PATCH"):
            req_fn = getattr(http_requests, method.lower())
            if isinstance(parsed_body, (dict, list)):
                resp = req_fn(url, json=parsed_body, **kwargs)
            else:
                resp = req_fn(url, data=parsed_body, **kwargs)
        elif method == "DELETE":
            resp = http_requests.delete(url, **kwargs)
        else:
            return {"error": f"Unsupported method: {method}"}, 400

        response_time_ms = (time.perf_counter() - start) * 1000
        status_code = resp.status_code
        response_headers = dict(resp.headers)

        try:
            response_body = resp.json()
        except (ValueError, json.JSONDecodeError):
            response_body = resp.text[:50000]

    except http_requests.exceptions.Timeout:
        error = "Request timed out"
    except http_requests.exceptions.ConnectionError:
        error = "Connection failed — check URL or network"
    except http_requests.exceptions.RequestException as e:
        error = str(e)

    threshold = get_threshold_for_url(url, default_threshold_ms)
    is_slow = response_time_ms > threshold if not error else False

    test = ApiTest(
        url=url,
        method=method,
        request_headers=json.dumps(headers),
        request_body=json.dumps(parsed_body) if parsed_body else (body or None),
        status_code=status_code,
        response_body=(
            json.dumps(response_body)
            if isinstance(response_body, (dict, list))
            else response_body
        ),
        response_headers=json.dumps(response_headers) if response_headers else None,
        response_time_ms=round(response_time_ms, 2),
        error=error,
        collection=collection,
    )
    db.session.add(test)
    db.session.commit()

    return {
        "url": url,
        "method": method,
        "status_code": status_code,
        "response_time_ms": round(response_time_ms, 2),
        "response_body": response_body,
        "response_headers": response_headers,
        "error": error,
        "is_slow": is_slow,
        "threshold_ms": threshold,
        "created_at": test.created_at.isoformat(),
    }, 200
