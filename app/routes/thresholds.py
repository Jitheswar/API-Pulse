from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.threshold import Threshold
from app.utils.validation import ThresholdSchema

thresholds_bp = Blueprint("thresholds", __name__, url_prefix="/api/thresholds")

threshold_schema = ThresholdSchema()


@thresholds_bp.route("", methods=["GET"])
@jwt_required()
def get_thresholds():
    rows = Threshold.query.order_by(Threshold.url_pattern).all()
    return jsonify([r.to_dict() for r in rows])


@thresholds_bp.route("", methods=["POST"])
@jwt_required()
def set_threshold():
    data = threshold_schema.load(request.get_json())

    existing = Threshold.query.filter_by(url_pattern=data["url_pattern"]).first()
    if existing:
        existing.max_response_time_ms = data["max_response_time_ms"]
    else:
        existing = Threshold(
            url_pattern=data["url_pattern"],
            max_response_time_ms=data["max_response_time_ms"],
        )
        db.session.add(existing)

    db.session.commit()
    return jsonify({"ok": True})


@thresholds_bp.route("/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete_threshold(tid):
    threshold = db.session.get(Threshold, tid)
    if not threshold:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(threshold)
    db.session.commit()
    return jsonify({"ok": True})
