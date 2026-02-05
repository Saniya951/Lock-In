from decouple import config

# MongoDB settings
MONGODB_URL = config("MONGODB_URL", default="mongodb://localhost:27017")
DATABASE_NAME = config("DATABASE_NAME", default="lockin")

# JWT settings
SECRET_KEY = config("SECRET_KEY", default="your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Email settings
MAIL_USERNAME = config("MAIL_USERNAME")
MAIL_PASSWORD = config("MAIL_PASSWORD")
MAIL_FROM = config("MAIL_FROM", default="noreply@lockin.com")
MAIL_PORT = 587
MAIL_SERVER = config("MAIL_SERVER", default="smtp.gmail.com")
MAIL_STARTTLS = True
MAIL_SSL_TLS = False