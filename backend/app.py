import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
from extensions import db, jwt, migrate, limiter

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(ROOT, "..", "frontend", "dist"))
MEDIA = os.path.join(ROOT, "media")  # your own video files / HLS output (see tools/make_hls.py)


def create_app(overrides=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"], "supports_credentials": True}}, expose_headers=["Content-Type", "Authorization"])

    from routes import auth, titles, me, admin, media
    for mod in (auth, titles, me, admin, media):
        app.register_blueprint(mod.bp)

    with app.app_context():
        db.create_all()

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", app="Vortex")

    @jwt.unauthorized_loader
    @jwt.invalid_token_loader
    def _bad_token(reason):
        return jsonify(error="Please sign in again."), 401

    @jwt.expired_token_loader
    def _expired(_h, _p):
        return jsonify(error="Your session expired. Please sign in again."), 401

    @jwt.token_in_blocklist_loader
    def _revoked(_header, payload):
        from models import AuthSession, AuthState, User

        try:
            user_id = int(payload.get("sub"))
        except (TypeError, ValueError):
            return True
        if not db.session.get(User, user_id):
            return True
        state = db.session.get(AuthState, user_id)
        current_version = state.token_version if state else 0
        try:
            token_version = int(payload.get("sv", 0))
        except (TypeError, ValueError):
            return True
        if token_version != current_version:
            return True
        session_id = payload.get("sid")
        if session_id:
            auth_session = db.session.get(AuthSession, session_id)
            return not auth_session or auth_session.user_id != user_id or auth_session.revoked_at is not None
        return False

    @app.errorhandler(429)
    def _rate_limited(_error):
        return jsonify(error="Too many requests. Please wait a moment and try again."), 429

    @app.errorhandler(413)
    def _upload_too_large(_error):
        return jsonify(error="Upload is too large. Video files must be 2 GB or smaller."), 413

    @app.get("/media/<path:path>")
    def media(path):
        requested = path.replace("\\", "/")
        if not requested.startswith(("video/", "subtitle/")):
            return send_from_directory(MEDIA, path, conditional=True)
        from models import MediaAsset

        protected = MediaAsset.query.filter(
            MediaAsset.storage_provider == "local",
            MediaAsset.file_type.in_(("video", "subtitle")),
        ).all()
        for asset in protected:
            asset_path = asset.file_path.replace("\\", "/")
            directory = os.path.dirname(asset_path).replace("\\", "/")
            if requested == asset_path or (
                asset_path.lower().endswith(".m3u8")
                and directory not in ("", asset.file_type)
                and requested.startswith(directory.rstrip("/") + "/")
            ):
                return jsonify(error="This media requires an authenticated, short-lived playback link."), 403
        return send_from_directory(app.config.get("MEDIA_ROOT") or MEDIA, path, conditional=True)

    # Serve the built React app when it exists (single-process deployment).
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def spa(path):
        if path.startswith("api/"):
            return jsonify(error="Not found."), 404
        if os.path.isdir(DIST):
            full = os.path.join(DIST, path)
            if path and os.path.isfile(full):
                return send_from_directory(DIST, path)
            return send_from_directory(DIST, "index.html")
        return jsonify(message="Vortex API is running. Start the frontend with `npm run dev` in /frontend."), 200

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
