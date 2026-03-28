import json
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import Schema, fields, validate

from app.extensions import db
from app.models.environment import Environment

environments_bp = Blueprint("environments", __name__, url_prefix="/api/environments")


class EnvironmentSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    variables = fields.Dict(keys=fields.String(), values=fields.String(), required=True)


env_schema = EnvironmentSchema()


@environments_bp.route("", methods=["GET"])
@jwt_required()
def list_environments():
    envs = Environment.query.order_by(Environment.name).all()
    return jsonify([e.to_dict() for e in envs])


@environments_bp.route("", methods=["POST"])
@jwt_required()
def create_environment():
    data = env_schema.load(request.get_json())
    existing = Environment.query.filter_by(name=data["name"]).first()
    if existing:
        existing.variables = json.dumps(data["variables"])
    else:
        existing = Environment(name=data["name"], variables=json.dumps(data["variables"]))
        db.session.add(existing)
    db.session.commit()
    return jsonify(existing.to_dict()), 201


@environments_bp.route("/<int:env_id>", methods=["PUT"])
@jwt_required()
def update_environment(env_id):
    env = db.session.get(Environment, env_id)
    if not env:
        return jsonify({"error": "Not found"}), 404
    data = env_schema.load(request.get_json())
    env.name = data["name"]
    env.variables = json.dumps(data["variables"])
    db.session.commit()
    return jsonify(env.to_dict())


@environments_bp.route("/<int:env_id>", methods=["DELETE"])
@jwt_required()
def delete_environment(env_id):
    env = db.session.get(Environment, env_id)
    if not env:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(env)
    db.session.commit()
    return jsonify({"ok": True})


@environments_bp.route("/resolve", methods=["POST"])
@jwt_required()
def resolve_variables():
    """Resolve {{var}} placeholders in a string using an environment's variables."""
    data = request.get_json()
    env_id = data.get("environment_id")
    text = data.get("text", "")

    if not env_id:
        return jsonify({"resolved": text})

    env = db.session.get(Environment, env_id)
    if not env:
        return jsonify({"error": "Environment not found"}), 404

    variables = json.loads(env.variables) if env.variables else {}
    resolved = _interpolate(text, variables)
    return jsonify({"resolved": resolved})


def _interpolate(text: str, variables: dict) -> str:
    """Replace {{key}} placeholders with variable values."""
    def replacer(match):
        key = match.group(1).strip()
        return variables.get(key, match.group(0))
    return re.sub(r"\{\{(.+?)\}\}", replacer, text)
