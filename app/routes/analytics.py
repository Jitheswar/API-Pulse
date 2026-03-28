from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.api_test import ApiTest

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.route("/performance", methods=["GET"])
@jwt_required()
def performance_analytics():
    url = request.args.get("url", "")
    limit = request.args.get("limit", 50, type=int)

    query = ApiTest.query.filter(ApiTest.error.is_(None))
    if url:
        query = query.filter(ApiTest.url == url)

    rows = query.order_by(ApiTest.created_at.desc()).limit(limit).all()

    return jsonify([
        {
            "url": r.url,
            "status_code": r.status_code,
            "response_time_ms": r.response_time_ms,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ])


@analytics_bp.route("/summary", methods=["GET"])
@jwt_required()
def analytics_summary():
    rows = db.session.execute(
        db.text("""
            SELECT
                url,
                COUNT(*) as total_tests,
                ROUND(AVG(response_time_ms), 2) as avg_time,
                ROUND(MIN(response_time_ms), 2) as min_time,
                ROUND(MAX(response_time_ms), 2) as max_time,
                SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status_code >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
                MAX(created_at) as last_tested
            FROM api_tests
            GROUP BY url
            ORDER BY total_tests DESC
        """)
    ).fetchall()

    return jsonify([dict(r._mapping) for r in rows])


@analytics_bp.route("/slow", methods=["GET"])
@jwt_required()
def slow_apis():
    threshold = request.args.get("threshold", 1000, type=float)
    rows = db.session.execute(
        db.text("""
            SELECT
                url,
                COUNT(*) as total_tests,
                ROUND(AVG(response_time_ms), 2) as avg_time,
                ROUND(MAX(response_time_ms), 2) as max_time,
                SUM(CASE WHEN response_time_ms > :threshold THEN 1 ELSE 0 END) as slow_count
            FROM api_tests
            WHERE error IS NULL
            GROUP BY url
            HAVING slow_count > 0
            ORDER BY avg_time DESC
        """),
        {"threshold": threshold},
    ).fetchall()

    return jsonify([dict(r._mapping) for r in rows])


@analytics_bp.route("/compare", methods=["GET"])
@jwt_required()
def compare_runs():
    urls = request.args.getlist("url")
    if not urls:
        return jsonify({"error": "Provide at least one url parameter"}), 400

    result = {}
    for url in urls:
        runs = (
            ApiTest.query.filter(ApiTest.url == url, ApiTest.error.is_(None))
            .order_by(ApiTest.created_at.desc())
            .limit(50)
            .all()
        )

        recent_avg = db.session.execute(
            db.text("""
                SELECT ROUND(AVG(response_time_ms), 2) as avg
                FROM (SELECT response_time_ms FROM api_tests
                      WHERE url = :url AND error IS NULL
                      ORDER BY created_at DESC LIMIT 25)
            """),
            {"url": url},
        ).fetchone()

        older_avg = db.session.execute(
            db.text("""
                SELECT ROUND(AVG(response_time_ms), 2) as avg
                FROM (SELECT response_time_ms FROM api_tests
                      WHERE url = :url AND error IS NULL
                      ORDER BY created_at DESC LIMIT 25 OFFSET 25)
            """),
            {"url": url},
        ).fetchone()

        recent_val = recent_avg[0] if recent_avg and recent_avg[0] is not None else 0
        older_val = older_avg[0] if older_avg and older_avg[0] is not None else None
        trend = round(recent_val - older_val, 2) if older_val is not None else None

        stats = db.session.execute(
            db.text("""
                SELECT
                    COUNT(*) as total,
                    ROUND(AVG(response_time_ms), 2) as avg_time,
                    ROUND(MIN(response_time_ms), 2) as min_time,
                    ROUND(MAX(response_time_ms), 2) as max_time
                FROM api_tests
                WHERE url = :url AND error IS NULL
            """),
            {"url": url},
        ).fetchone()

        stats_dict = dict(stats._mapping) if stats else {}
        stats_dict["trend"] = trend
        result[url] = {
            "runs": [
                {
                    "id": r.id,
                    "status_code": r.status_code,
                    "response_time_ms": r.response_time_ms,
                    "created_at": r.created_at.isoformat(),
                }
                for r in runs
            ],
            "stats": stats_dict,
        }

    return jsonify(result)
