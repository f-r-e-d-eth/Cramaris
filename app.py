import json
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
MOCKUP_DIR = BASE_DIR / "mockup"
DEFAULT_VAULT_DIR = BASE_DIR / "vault"

CONFIG_DIR = Path.home() / ".config" / "endecrypt"
CONFIG_FILE = CONFIG_DIR / "config.json"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
IGNORED_NAMES = {".endecrypt.json"}
IGNORED_EXTENSIONS = {".py", ".pyc"}

app = Flask(__name__)


def load_config():
    if not CONFIG_FILE.exists():
        return {}

    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_config(config):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(
        json.dumps(config, indent=2),
        encoding="utf-8",
    )


def get_vault_dir():
    config = load_config()
    configured = config.get("vault_path")

    if configured:
        path = Path(configured).expanduser()
        if path.is_dir():
            return path.resolve()

    DEFAULT_VAULT_DIR.mkdir(parents=True, exist_ok=True)
    return DEFAULT_VAULT_DIR.resolve()


def scan_vault(vault_dir):
    files = []
    images = []

    for path in sorted(vault_dir.iterdir(), key=lambda item: item.name.lower()):
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
            line_count = sum(
                1
                for _ in path.open(
                    "r",
                    encoding="utf-8",
                    errors="replace",
                )
            )
        except OSError:
            line_count = 0

        files.append({
            "name": path.name,
            "lines": line_count,
        })

    return files, images


@app.get("/")
def index():
    get_vault_dir()
    return send_from_directory(MOCKUP_DIR, "index.html")


@app.route("/api/vault", methods=["GET", "POST"])
def vault_info():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        requested_path = str(data.get("path", "")).strip()

        if not requested_path:
            return jsonify({"error": "No folder path supplied."}), 400

        path = Path(requested_path).expanduser()

        if not path.is_dir():
            return jsonify({"error": "Folder does not exist."}), 400

        path = path.resolve()

        config = load_config()
        config["vault_path"] = str(path)
        save_config(config)

    vault_dir = get_vault_dir()
    files, images = scan_vault(vault_dir)

    return jsonify({
        "path": str(vault_dir),
        "files": files,
        "images": images,
    })


@app.get("/vault-image/<path:filename>")
def vault_image(filename):
    vault_dir = get_vault_dir()
    return send_from_directory(vault_dir, filename)


@app.get("/<path:filename>")
def mockup_file(filename):
    return send_from_directory(MOCKUP_DIR, filename)


if __name__ == "__main__":
    get_vault_dir()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
