import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.api_test import ApiTest
from app.models.threshold import Threshold
from app.routes.auth import admin_required

history_bp = Blueprint("history", __name__, url_prefix="/api/history")

DEFAULT_SLOW_THRESHOLD_MS = 1000


def _url_matches_pattern(url: str, pattern: str) -> bool:
    regex = "^" + re.escape(pattern).replace(r"\%", ".*").replace(r"\_", ".") + "$"
    return bool(re.match(regex, url))


def _escape_like(value: str) -> str:
    """Escape special LIKE pattern characters in user input."""
    return value.replace("%", r"\%").replace("_", r"\_")


@history_bp.route("", methods=["GET"])
@jwt_required()
def get_history():
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)
    url_filter = request.args.get("url", "")
    collection = request.args.get("collection", "")

    query = ApiTest.query
    if url_filter:
        safe_filter = _escape_like(url_filter)
        query = query.filter(ApiTest.url.like(f"%{safe_filter}%", escape="\\"))
    if collection:
        query = query.filter(ApiTest.collection == collection)

    pagination = query.order_by(ApiTest.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    thresholds = Threshold.query.order_by(
        db.func.length(Threshold.url_pattern).desc()
    ).all()

    results = []
    for t in pagination.items:
        threshold_ms = DEFAULT_SLOW_THRESHOLD_MS
        for th in thresholds:
            if _url_matches_pattern(t.url, th.url_pattern):
                threshold_ms = th.max_response_time_ms
                break
        summary = t.to_summary()
        summary["threshold_ms"] = threshold_ms
        results.append(summary)

    return jsonify({
        "items": results,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    })


@history_bp.route("/<int:test_id>", methods=["GET"])
@jwt_required()
def get_test_detail(test_id):
    test = db.session.get(ApiTest, test_id)
    if not test:
        return jsonify({"error": "Not found"}), 404
    return jsonify(test.to_detail())


@history_bp.route("/<int:test_id>", methods=["DELETE"])
@jwt_required()
def delete_test(test_id):
    test = db.session.get(ApiTest, test_id)
    if not test:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(test)
    db.session.commit()
    return jsonify({"ok": True})


@history_bp.route("", methods=["DELETE"])
@admin_required
def clear_history():
    ApiTest.query.delete()
    db.session.commit()
    return jsonify({"ok": True})
