from datetime import datetime, timezone

from app.extensions import db


class ApiTest(db.Model):
    __tablename__ = "api_tests"

    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Text, nullable=False, index=True)
    method = db.Column(db.String(10), nullable=False)
    request_headers = db.Column(db.Text)
    request_body = db.Column(db.Text)
    status_code = db.Column(db.Integer)
    response_body = db.Column(db.Text)
    response_headers = db.Column(db.Text)
    response_time_ms = db.Column(db.Float)
    error = db.Column(db.Text)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    collection = db.Column(db.String(100), default="Default")

    def to_summary(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "method": self.method,
            "status_code": self.status_code,
            "response_time_ms": self.response_time_ms,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "collection": self.collection,
        }

    def to_detail(self) -> dict:
        import json

        result = {
            "id": self.id,
            "url": self.url,
            "method": self.method,
            "status_code": self.status_code,
            "response_time_ms": self.response_time_ms,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "collection": self.collection,
            "request_headers": self.request_headers,
            "request_body": self.request_body,
            "response_body": self.response_body,
            "response_headers": self.response_headers,
        }
        for field in ("request_headers", "response_body", "response_headers"):
            if result[field]:
                try:
                    result[field] = json.loads(result[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return result
