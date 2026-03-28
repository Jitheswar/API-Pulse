import json
import logging

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db, limiter
from app.models.environment import Environment
from app.routes.environments import _interpolate
from app.services.api_tester import execute_api_test
from app.utils.validation import TestRequestSchema

logger = logging.getLogger(__name__)
testing_bp = Blueprint("testing", __name__, url_prefix="/api")

test_schema = TestRequestSchema()


@testing_bp.route("/test", methods=["POST"])
@jwt_required()
@limiter.limit("30/minute")
def test_api():
    data = test_schema.load(request.get_json())

    # Resolve environment variables if an environment is specified
    env_id = request.get_json().get("environment_id")
    variables = {}
    if env_id:
        env = db.session.get(Environment, env_id)
        if env:
            variables = json.loads(env.variables) if env.variables else {}

    # Parse headers if string
    headers = data["headers"]
    if isinstance(headers, str):
        try:
            headers = json.loads(_interpolate(headers, variables)) if headers.strip() else {}
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON in headers"}), 400
    elif variables and isinstance(headers, dict):
        headers = json.loads(_interpolate(json.dumps(headers), variables))

    url = _interpolate(data["url"].strip(), variables) if variables else data["url"].strip()
    body = _interpolate(data["body"], variables) if variables and isinstance(data["body"], str) else data["body"]

    default_threshold = current_app.config.get("DEFAULT_SLOW_THRESHOLD_MS", 1000)
    result, status = execute_api_test(
        url=url,
        method=data["method"].upper(),
        headers=headers,
        body=body,
        collection=data["collection"],
        timeout_sec=data["timeout"],
        default_threshold_ms=default_threshold,
    )

    logger.info(
        "API test: %s %s -> %s (%s ms)",
        data["method"],
        data["url"],
        result.get("status_code"),
        result.get("response_time_ms"),
    )

    return jsonify(result), status
