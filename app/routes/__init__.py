from app.routes.analytics import analytics_bp
from app.routes.auth import auth_bp
from app.routes.collections import collections_bp
from app.routes.environments import environments_bp
from app.routes.health import health_bp
from app.routes.history import history_bp
from app.routes.testing import testing_bp
from app.routes.thresholds import thresholds_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(testing_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(thresholds_bp)
    app.register_blueprint(collections_bp)
    app.register_blueprint(environments_bp)
    app.register_blueprint(health_bp)
