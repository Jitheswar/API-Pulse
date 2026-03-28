from flask import Blueprint, jsonify

from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    checks = {"status": "healthy", "database": "ok"}
    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception:
        checks["database"] = "error"
        checks["status"] = "unhealthy"
        return jsonify(checks), 503
    return jsonify(checks)
