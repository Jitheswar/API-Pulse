import logging
import os
import sys

from flask import Flask, render_template

from app.config import config
from app.extensions import cors, db, jwt, limiter, ma, migrate
from app.middleware.error_handlers import register_error_handlers
from app.routes import register_blueprints


def configure_logging(app):
    log_level = logging.DEBUG if app.debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    formatter = logging.Formatter(
        '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}'
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(log_level)
    root.addHandler(handler)

    # Silence noisy loggers
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"),
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),
    )
    app.config.from_object(config[config_name])

    # Configure structured logging
    configure_logging(app)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    ma.init_app(app)

    # CORS
    origins = app.config.get("CORS_ORIGINS", "*")
    if origins and origins != "*":
        cors.init_app(app, origins=origins.split(","))
    else:
        cors.init_app(app)

    # Rate limiter
    limiter.init_app(app)

    # Prometheus metrics
    try:
        from prometheus_flask_instrumentator import Instrumentator
        Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    except ImportError:
        pass  # prometheus_flask_instrumentator not installed — skip metrics

    # Register blueprints and error handlers
    register_blueprints(app)
    register_error_handlers(app)

    # Swagger/OpenAPI docs
    try:
        from flask_swagger_ui import get_swaggerui_blueprint
        swagger_bp = get_swaggerui_blueprint(
            "/api/docs", "/static/openapi.json",
            config={"app_name": "API Pulse"},
        )
        app.register_blueprint(swagger_bp, url_prefix="/api/docs")
    except ImportError:
        pass  # flask-swagger-ui not installed — skip docs

    # Serve frontend
    @app.route("/")
    def index():
        return render_template("index.html")

    # Create tables on first request (for development without migrations)
    with app.app_context():
        from app.models import ApiTest, Environment, Threshold, User  # noqa: F401
        db.create_all()

    return app
