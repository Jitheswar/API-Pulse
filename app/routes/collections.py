from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.api_test import ApiTest

collections_bp = Blueprint("collections", __name__, url_prefix="/api/collections")


@collections_bp.route("", methods=["GET"])
@jwt_required()
def get_collections():
    rows = (
        db.session.query(ApiTest.collection)
        .distinct()
        .order_by(ApiTest.collection)
        .all()
    )
    return jsonify([r[0] for r in rows])
