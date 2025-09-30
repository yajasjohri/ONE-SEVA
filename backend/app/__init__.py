from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .config.settings import settings
from .api.routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    origins = [o.strip() for o in str(settings.cors_origins).split(",") if o.strip()]
    if not origins:
        origins = ["*"]
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type", "Authorization"],
    )
    app.config["JWT_SECRET_KEY"] = settings.secret_key
    JWTManager(app)

    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "env": settings.environment}), 200

    return app


