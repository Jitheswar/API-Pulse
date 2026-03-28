from datetime import datetime, timezone

from app.extensions import db


class Environment(db.Model):
    __tablename__ = "environments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    variables = db.Column(db.Text, nullable=False, default="{}")
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self) -> dict:
        import json

        return {
            "id": self.id,
            "name": self.name,
            "variables": json.loads(self.variables) if self.variables else {},
            "created_at": self.created_at.isoformat(),
        }
