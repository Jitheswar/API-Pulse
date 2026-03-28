from app.extensions import db


class Threshold(db.Model):
    __tablename__ = "thresholds"

    id = db.Column(db.Integer, primary_key=True)
    url_pattern = db.Column(db.Text, nullable=False, unique=True)
    max_response_time_ms = db.Column(db.Float, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url_pattern": self.url_pattern,
            "max_response_time_ms": self.max_response_time_ms,
        }
