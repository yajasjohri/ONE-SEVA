from app import create_app
from app.config.settings import settings

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=settings.port, debug=settings.environment == "development")


