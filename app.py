from pathlib import Path

from flask import Flask, jsonify, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
MOCKUP_DIR = BASE_DIR / "mockup"
VAULT_DIR = BASE_DIR / "vault"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
IGNORED_NAMES = {".endecrypt.json"}
IGNORED_EXTENSIONS = {".py", ".pyc"}

app = Flask(__name__)


def ensure_vault():
    VAULT_DIR.mkdir(parents=True, exist_ok=True)


def scan_vault():
    ensure_vault()

    files = []
    images = []

    for path in sorted(VAULT_DIR.iterdir(), key=lambda item: item.name.lower()):
        if not path.is_file():
            continue

        if path.name.startswith(".") or path.name in IGNORED_NAMES:
            continue

        suffix = path.suffix.lower()

        if suffix in IMAGE_EXTENSIONS:
            images.append({
                "name": path.name,
                "url": f"/vault-image/{path.name}",
            })
            continue

        if suffix in IGNORED_EXTENSIONS:
            continue

        try:
            line_count = sum(1 for _ in path.open("r", encoding="utf-8", errors="replace"))
        except OSError:
            line_count = 0

        files.append({
            "name": path.name,
            "lines": line_count,
        })

    return files, images


@app.get("/")
def index():
    ensure_vault()
    return send_from_directory(MOCKUP_DIR, "index.html")


@app.get("/api/vault")
def vault_info():
    files, images = scan_vault()

    return jsonify({
        "path": str(VAULT_DIR),
        "files": files,
        "images": images,
    })


@app.get("/vault-image/<path:filename>")
def vault_image(filename):
    return send_from_directory(VAULT_DIR, filename)


@app.get("/<path:filename>")
def mockup_file(filename):
    return send_from_directory(MOCKUP_DIR, filename)


if __name__ == "__main__":
    ensure_vault()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
