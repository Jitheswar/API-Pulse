from marshmallow import Schema, fields, validate


class TestRequestSchema(Schema):
    url = fields.String(required=True, validate=validate.Length(min=1, max=2048))
    method = fields.String(
        load_default="GET",
        validate=validate.OneOf(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    )
    headers = fields.Raw(load_default={})
    body = fields.Raw(load_default="")
    collection = fields.String(load_default="Default", validate=validate.Length(max=100))
    timeout = fields.Integer(load_default=30, validate=validate.Range(min=1, max=120))
    environment_id = fields.Integer(load_default=None, allow_none=True)


class ThresholdSchema(Schema):
    url_pattern = fields.String(required=True, validate=validate.Length(min=1, max=2048))
    max_response_time_ms = fields.Float(required=True, validate=validate.Range(min=1))


class RegisterSchema(Schema):
    username = fields.String(
        required=True, validate=[validate.Length(min=3, max=80), validate.Regexp(r"^[a-zA-Z0-9_]+$")]
    )
    email = fields.Email(required=True, validate=validate.Length(max=120))
    password = fields.String(required=True, validate=validate.Length(min=8, max=128))


class LoginSchema(Schema):
    username = fields.String(required=True)
    password = fields.String(required=True)
