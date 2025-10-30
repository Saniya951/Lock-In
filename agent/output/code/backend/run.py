from flask import Flask, jsonify
from mongoengine import connect
from config import Config


def create_app() -> Flask:
    """Application factory for the Flask backend.

    Returns
    -------
    Flask
        Configured Flask application instance.
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialise MongoEngine connection
    connect(host=app.config["MONGODB_URI"])

    @app.route("/api/health")
    def health_check():
        """Simple health‑check endpoint used by the frontend or CI pipelines."""
        return jsonify({"status": "ok", "environment": "development" if app.debug else "production"})

    return app


# When run directly, start the development server.
if __name__ == "__main__":
    application = create_app()
    # Flask's built‑in server is fine for local development only.
    application.run(host="0.0.0.0", port=5000, debug=application.debug)
