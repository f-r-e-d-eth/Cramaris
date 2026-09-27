import base64
import hashlib
import hmac
import json
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_VAULT_DIR = BASE_DIR / "vault"

CONFIG_DIR = Path.home() / ".config" / "cramaris"
CONFIG_FILE = CONFIG_DIR / "config.json"
LEGACY_CONFIG_FILE = Path.home() / ".config" / "endecrypt" / "config.json"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
IGNORED_NAMES = {".cramaris.json", ".endecrypt.json"}
IGNORED_EXTENSIONS = {".py", ".pyc"}

ALPHABET = (
    "0123456789"
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    " +-*/!.,:;()[]{}_?=@#$%&"
)
N = len(ALPHABET)
CHAR_TO_NUM = {char: index for index, char in enumerate(ALPHABET)}
NUM_TO_CHAR = {index: char for index, char in enumerate(ALPHABET)}

app = Flask(__name__)


def load_config():
    path = CONFIG_FILE if CONFIG_FILE.exists() else LEGACY_CONFIG_FILE

    if not path.exists():
        return {}

    try:
        return json.loads(path.read_text(encoding="utf-8"))
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


def safe_vault_file(filename):
    vault_dir = get_vault_dir()
    path = (vault_dir / filename).resolve()

    if path.parent != vault_dir:
        raise ValueError("Invalid file path.")

    if not path.is_file():
        raise FileNotFoundError(filename)

    return path


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
            line_count = len(
                path.read_text(
                    encoding="utf-8",
                    errors="replace",
                ).splitlines()
            )
        except OSError:
            line_count = 0

        files.append({
            "name": path.name,
            "lines": line_count,
        })

    return files, images


def read_text_lines(path):
    return path.read_text(
        encoding="utf-8",
        errors="replace",
    ).splitlines()


def write_text_lines(path, lines):
    text = "\n".join(lines)

    if lines:
        text += "\n"

    path.write_text(
        text,
        encoding="utf-8",
    )


def combined_credential(master_password, key):
    return master_password + key


def password_to_key(password):
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        b"LineCipherExperiment-v1",
        200_000,
        dklen=32,
    )


def make_keystream(key, nonce, length):
    result = bytearray()
    counter = 0

    while len(result) < length:
        message = nonce + counter.to_bytes(8, "big")
        result.extend(
            hmac.new(
                key,
                message,
                hashlib.sha256,
            ).digest()
        )
        counter += 1

    return result[:length]


def validate_plaintext(text):
    for char in text:
        if char not in CHAR_TO_NUM:
            raise ValueError(
                f"Unsupported character {char!r}. "
                "Encrypted lines may only use the configured Cramaris alphabet."
            )


def encrypt_line(text, password):
    validate_plaintext(text)

    nonce = os.urandom(16)
    key = password_to_key(password)
    stream = make_keystream(key, nonce, len(text))

    encrypted = []

    for char, random_byte in zip(text, stream):
        plain_number = CHAR_TO_NUM[char]
        key_number = random_byte % N
        encrypted_number = (plain_number + key_number) % N
        encrypted.append(NUM_TO_CHAR[encrypted_number])

    nonce_text = base64.urlsafe_b64encode(nonce).decode("ascii")
    return nonce_text + "|" + "".join(encrypted)


def decrypt_line(line, password):
    if "|" not in line:
        raise ValueError("missing nonce separator '|'")

    nonce_text, encrypted = line.split("|", 1)

    if not nonce_text:
        raise ValueError("missing nonce")

    try:
        nonce = base64.urlsafe_b64decode(
            nonce_text.encode("ascii"),
        )
    except (ValueError, UnicodeError) as error:
        raise ValueError("invalid nonce encoding") from error

    if len(nonce) != 16:
        raise ValueError(
            f"invalid nonce length ({len(nonce)} bytes, expected 16)"
        )

    for char in encrypted:
        if char not in CHAR_TO_NUM:
            raise ValueError(
                f"ciphertext contains unsupported character {char!r}"
            )

    key = password_to_key(password)
    stream = make_keystream(key, nonce, len(encrypted))

    decrypted = []

    for char, random_byte in zip(encrypted, stream):
        encrypted_number = CHAR_TO_NUM[char]
        key_number = random_byte % N
        plain_number = (encrypted_number - key_number) % N
        decrypted.append(NUM_TO_CHAR[plain_number])

    return "".join(decrypted)


def decrypt_file_lines(path, password):
    raw_lines = read_text_lines(path)
    result = []

    for index, raw_line in enumerate(raw_lines, start=1):
        try:
            result.append({
                "text": decrypt_line(raw_line, password),
                "error": None,
            })
        except (ValueError, UnicodeError) as error:
            result.append({
                "text": f"[ENCRYPTION ERROR: line {index}: {error}]",
                "error": str(error),
            })

    return result



PREFERENCES_FILE = ".cramaris.json"
LEGACY_PREFERENCES_FILE = ".endecrypt.json"

DEFAULT_PREFERENCES = {
    "defaults": {
        "background": "dark",
        "glass": 20,
        "color": "#55f3ff",
    },
    "files": {},
    "ui": {
        "crypto_enabled": True,
        "clock_mode": 0,
    },
}


def get_preferences_path():
    return get_vault_dir() / PREFERENCES_FILE


def load_preferences():
    path = get_preferences_path()

    if not path.exists():
        legacy_path = get_vault_dir() / LEGACY_PREFERENCES_FILE
        path = legacy_path if legacy_path.exists() else path

    if not path.exists():
        return json.loads(json.dumps(DEFAULT_PREFERENCES))

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return json.loads(json.dumps(DEFAULT_PREFERENCES))

    preferences = json.loads(json.dumps(DEFAULT_PREFERENCES))

    if isinstance(data, dict):
        if isinstance(data.get("defaults"), dict):
            preferences["defaults"].update(data["defaults"])

        if isinstance(data.get("files"), dict):
            preferences["files"] = data["files"]

        if isinstance(data.get("ui"), dict):
            preferences["ui"].update(data["ui"])

    return preferences


def save_preferences(preferences):
    path = get_preferences_path()
    path.write_text(
        json.dumps(
            preferences,
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )


def valid_hex_color(value):
    if not isinstance(value, str):
        return False

    if len(value) != 7 or not value.startswith("#"):
        return False

    try:
        int(value[1:], 16)
    except ValueError:
        return False

    return True


@app.get("/")
def index():
    get_vault_dir()
    return render_template("index.html")


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


@app.post("/api/file")
def create_file():
    data = request.get_json(silent=True) or {}
    filename = str(data.get("name", "")).strip()

    if not filename:
        return jsonify({"error": "Please enter a file name."}), 400

    if filename in {".", ".."} or "/" in filename or "\\" in filename:
        return jsonify({"error": "File name must not contain path separators."}), 400

    if filename.startswith("."):
        return jsonify({"error": "Hidden file names are reserved."}), 400

    if filename in IGNORED_NAMES:
        return jsonify({"error": "That file name is reserved by Cramaris."}), 400

    if Path(filename).suffix.lower() in IMAGE_EXTENSIONS:
        return jsonify({"error": "Image extensions are reserved for backgrounds."}), 400

    if Path(filename).suffix.lower() in IGNORED_EXTENSIONS:
        return jsonify({"error": "That file extension is ignored by Cramaris."}), 400

    vault_dir = get_vault_dir()
    path = vault_dir / filename

    if path.exists():
        return jsonify({"error": "A file with that name already exists."}), 409

    try:
        path.touch(exist_ok=False)
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "ok": True,
        "name": filename,
    }), 201


@app.get("/api/file/<path:filename>")
def read_file(filename):
    try:
        path = safe_vault_file(filename)
        lines = read_text_lines(path)
    except (ValueError, FileNotFoundError):
        return jsonify({"error": "File not found."}), 404
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "name": path.name,
        "lines": lines,
    })


@app.put("/api/file/<path:filename>")
def write_file(filename):
    data = request.get_json(silent=True) or {}
    lines = data.get("lines")

    if not isinstance(lines, list) or not all(
        isinstance(line, str)
        for line in lines
    ):
        return jsonify({
            "error": "Expected a list of text lines."
        }), 400

    try:
        path = safe_vault_file(filename)
        write_text_lines(path, lines)
    except (ValueError, FileNotFoundError):
        return jsonify({"error": "File not found."}), 404
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "ok": True,
        "name": path.name,
        "lines": len(lines),
    })


@app.post("/api/crypt/<path:filename>/view")
def crypt_view(filename):
    data = request.get_json(silent=True) or {}
    master_password = str(data.get("master_password", ""))
    secondary_key = str(data.get("key", ""))
    password = combined_credential(
        master_password,
        secondary_key,
    )

    try:
        path = safe_vault_file(filename)
        lines = decrypt_file_lines(path, password)
    except (ValueError, FileNotFoundError):
        return jsonify({"error": "File not found."}), 404
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    error_count = sum(
        1 for line in lines
        if line["error"] is not None
    )

    return jsonify({
        "name": path.name,
        "lines": lines,
        "error_count": error_count,
    })


@app.post("/api/crypt/<path:filename>/line")
def crypt_line(filename):
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    index = data.get("index")
    text = data.get("text", "")
    master_password = str(data.get("master_password", ""))
    secondary_key = str(data.get("key", ""))
    password = combined_credential(
        master_password,
        secondary_key,
    )

    if not isinstance(index, int):
        return jsonify({"error": "Invalid line index."}), 400

    try:
        path = safe_vault_file(filename)
        raw_lines = read_text_lines(path)

        if action == "update":
            if index < 0 or index >= len(raw_lines):
                return jsonify({"error": "Line index out of range."}), 400

            raw_lines[index] = encrypt_line(str(text), password)

        elif action == "insert":
            if index < 0 or index > len(raw_lines):
                return jsonify({"error": "Line index out of range."}), 400

            raw_lines.insert(
                index,
                encrypt_line(str(text), password),
            )

        elif action == "delete":
            if index < 0 or index >= len(raw_lines):
                return jsonify({"error": "Line index out of range."}), 400

            raw_lines.pop(index)

        else:
            return jsonify({"error": "Unknown line action."}), 400

        write_text_lines(path, raw_lines)

    except (ValueError, UnicodeError) as error:
        return jsonify({"error": str(error)}), 400
    except FileNotFoundError:
        return jsonify({"error": "File not found."}), 404
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "ok": True,
        "lines": len(raw_lines),
    })



@app.get("/api/preferences")
def get_preferences():
    return jsonify(load_preferences())


@app.put("/api/preferences")
def put_preferences():
    data = request.get_json(silent=True) or {}
    preferences = load_preferences()

    defaults = data.get("defaults")
    if isinstance(defaults, dict):
        if "background" in defaults and isinstance(defaults["background"], str):
            preferences["defaults"]["background"] = defaults["background"]

        if "glass" in defaults:
            try:
                glass = int(defaults["glass"])
            except (TypeError, ValueError):
                glass = preferences["defaults"]["glass"]
            preferences["defaults"]["glass"] = max(0, min(100, glass))

        if "color" in defaults and valid_hex_color(defaults["color"]):
            preferences["defaults"]["color"] = defaults["color"]

    files = data.get("files")
    if isinstance(files, dict):
        for filename, file_preferences in files.items():
            if not isinstance(filename, str) or not isinstance(file_preferences, dict):
                continue

            current = preferences["files"].get(filename, {}).copy()

            if "background" in file_preferences and isinstance(file_preferences["background"], str):
                current["background"] = file_preferences["background"]

            if "glass" in file_preferences:
                try:
                    glass = int(file_preferences["glass"])
                except (TypeError, ValueError):
                    glass = preferences["defaults"]["glass"]
                current["glass"] = max(0, min(100, glass))

            if "color" in file_preferences and valid_hex_color(file_preferences["color"]):
                current["color"] = file_preferences["color"]

            preferences["files"][filename] = current

    ui = data.get("ui")
    if isinstance(ui, dict):
        if "crypto_enabled" in ui:
            preferences["ui"]["crypto_enabled"] = bool(ui["crypto_enabled"])

        if "clock_mode" in ui:
            try:
                clock_mode = int(ui["clock_mode"])
            except (TypeError, ValueError):
                clock_mode = 0
            preferences["ui"]["clock_mode"] = clock_mode % 4

    try:
        save_preferences(preferences)
    except OSError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify(preferences)


@app.get("/vault-image/<path:filename>")
def vault_image(filename):
    vault_dir = get_vault_dir()
    return send_from_directory(vault_dir, filename)



if __name__ == "__main__":
    get_vault_dir()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
