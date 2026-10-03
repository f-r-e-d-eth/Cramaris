# Cramaris

Cramaris is a local Python/Flask text editor with optional experimental line-by-line encryption.

The project is built around one unusual idea: every line is encrypted independently, and there is deliberately no password-validity check. A wrong Master Password / Key combination therefore produces other characters from the allowed alphabet instead of a "wrong password" message.

> **Important:** Cramaris is an experimental / educational project. It intentionally does not use authenticated encryption and should not be treated as a replacement for established security tools.

## Current application

The main interface is a local browser UI served by Flask.

Current features include:

- selectable local vault folder;
- remembered vault location;
- real file list with line counts;
- plain-text editing with `CRYPT OFF`;
- encrypted editing with `CRYPT ON`;
- separate Master Password and Key fields;
- independent nonce for every encrypted line;
- edit, insert and delete individual lines;
- double-click below the last line to append a new line;
- create new empty files;
- malformed encrypted-line handling without crashing the rest of the document;
- backgrounds loaded from images in the selected vault;
- per-file background, glass/transparency and text color;
- persisted vault preferences in `.cramaris.json`;
- several clock display modes;
- independently scrollable document area;
- generic local privacy-inhibit heartbeat for capture tools.

## Quick start

Clone the repository:

```bash
git clone git@github.com:f-r-e-d-eth/Cramaris.git
cd Cramaris
```

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Start Cramaris:

```bash
python3 app.py
```

Then open:

```text
http://127.0.0.1:5000
```

To stop the server, press `Ctrl+C` in the terminal.

When starting it again later:

```bash
cd ~/Cramaris
source .venv/bin/activate
python3 app.py
```

## Vault folder

By default Cramaris uses:

```text
~/Cramaris/vault
```

Use **CHOOSE FOLDER** in the UI to select another directory.

The last selected vault is remembered in:

```text
~/.config/cramaris/config.json
```

The selected vault can contain:

- editable text/encrypted files;
- background images such as PNG, JPG, JPEG, WEBP and GIF;
- the automatically created `.cramaris.json` preference file.

Images and Cramaris support files are not shown as editable documents.

## Preferences

Each vault stores UI preferences in:

```text
.cramaris.json
```

These include:

- per-file background;
- per-file glass/transparency setting;
- per-file text/file color;
- CRYPT ON/OFF state;
- clock display mode.

The Master Password and Key are **not** stored.

If a configured background image is removed, Cramaris falls back to the dark background.

## Editing

Single-clicking a line leaves the text selectable for normal copying.

Double-click a line to edit it.

Inside the line editor:

- `Enter` saves;
- `Esc` cancels;
- **+ NEW LINE** inserts a new line below;
- **DELETE** deletes the current line;
- **CANCEL** exits without saving.

Double-clicking empty space below the document appends a blank line at the end and immediately opens it for editing.

## Creating a file

Press **+ NEW FILE** and enter a filename, for example:

```text
notes.enc
```

or:

```text
ideas.txt
```

Cramaris creates an empty file in the currently selected vault and selects it.

## CRYPT OFF

With `CRYPT OFF`, Cramaris behaves like a normal text editor.

Changes are written directly as UTF-8 text.

## CRYPT ON

With `CRYPT ON`, the Master Password and Key are combined internally as:

```text
Master Password + Key
```

Each line is stored independently in the form:

```text
base64_nonce|ciphertext
```

The current implementation uses:

- PBKDF2-HMAC-SHA256 for password-to-key derivation;
- a 16-byte random nonce per line;
- HMAC-SHA256 based keystream generation;
- modular arithmetic over the restricted Cramaris character alphabet.

Editing one encrypted line only replaces that line with a newly encrypted record and a new nonce. The other encrypted lines remain unchanged.

## Wrong passwords and malformed lines

There is deliberately no password correctness check.

Using another Master Password / Key combination still produces output from the allowed alphabet.

Malformed encrypted lines are handled separately. For example, a line without a nonce separator is shown as an encryption error while valid lines in the same document continue to decrypt.

## Allowed encrypted characters

Encrypted plaintext currently uses the restricted alphabet defined in `app.py`:

```text
0123456789
abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ
 +-*/!.,:;()[]{}_?=@#$%&
```

Characters outside this set cannot currently be saved in encrypted mode.

## Legacy CLI

The original command-line prototype is preserved as `legacy/Cramaris_cli.py` for reference.

The Flask application in `app.py` is now the primary interface.

## Development

`main` is the normal starting point for future development.

The original GUI mockup has been removed; the live frontend now uses the standard Flask `templates/` and `static/` folders.


## Privacy inhibit heartbeat

Cramaris publishes a small local heartbeat while its browser page is visible. This is intended as a generic opt-in signal for screenshot tools, screen recorders, activity loggers, and similar local applications.

The heartbeat file is written to:

```text
$XDG_RUNTIME_DIR/privacy-inhibit/cramaris.json
```

If `XDG_RUNTIME_DIR` is unavailable, Cramaris falls back to a per-user directory below `/tmp`.

The JSON payload contains the protocol name, application name, process ID, reason, update timestamp, and a maximum age.

Cramaris refreshes the heartbeat every five seconds while the page is visible. A consumer should treat the request as active only while the heartbeat timestamp is no older than 15 seconds. This makes stale files harmless after a browser or server crash.

This is a project convention rather than an official freedesktop.org standard. Other applications may publish their own JSON file in the same directory, and capture tools can honor any fresh request they find there.


## License

Cramaris is released under the MIT License: use it, modify it, redistribute it, or build on it as you like. The software is provided **as is**, without warranty, and the authors are not liable for problems or damages arising from its use.

See `LICENSE` for the full terms.
