import logging
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)

from app.extensions import db, limiter  # noqa: F811
from app.models.user import User
from app.utils.validation import LoginSchema, RegisterSchema

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

register_schema = RegisterSchema()
login_schema = LoginSchema()


def admin_required(fn):
    """Decorator that requires the current user to have the admin role."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5/hour")
def register():
    data = register_schema.load(request.get_json())

    if User.query.filter(
        (User.username == data["username"]) | (User.email == data["email"])
    ).first():
        return jsonify({"error": "Username or email already exists"}), 409

    user = User(username=data["username"], email=data["email"])
    user.set_password(data["password"])

    # First user gets admin role
    if User.query.count() == 0:
        user.role = "admin"

    db.session.add(user)
    db.session.commit()
    logger.info("User registered: %s", user.username)

    return jsonify({"message": "User created", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10/minute")
def login():
    data = login_schema.load(request.get_json())

    user = User.query.filter_by(username=data["username"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "username": user.username},
    )
    refresh_token = create_refresh_token(identity=str(user.id))
    logger.info("User logged in: %s", user.username)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    })


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({"error": "User not found"}), 404

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "username": user.username},
    )
    return jsonify({"access_token": access_token})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())
