import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"