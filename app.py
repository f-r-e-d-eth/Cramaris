from pathlib import Path

from flask import Flask, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
MOCKUP_DIR = BASE_DIR / "mockup"

app = Flask(__name__)


@app.get("/")
def index():
    return send_from_directory(MOCKUP_DIR, "index.html")


@app.get("/<path:filename>")
def mockup_file(filename):
    return send_from_directory(MOCKUP_DIR, filename)


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
