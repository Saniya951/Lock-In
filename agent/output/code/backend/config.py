import os
from dotenv import load_dotenv

# Load environment variables from a .env file located in the same directory as this file.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

class Config:
    """Base configuration class.

    All configuration values are read from environment variables with sensible
    defaults for local development. Extend this class for production‑specific
    settings if required.
    """

    # General Flask settings
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
    DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"
    TESTING = os.getenv("FLASK_TESTING", "0") == "1"

    # MongoDB / MongoEngine settings
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/portfolio")
    # MongoEngine uses separate settings; we will initialise it in run.py.

    # Additional configuration can be added here (e.g., CORS, JWT, etc.)
