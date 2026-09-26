# EnDeCrypt

EnDeCrypt is a local Python/Flask text editor with optional experimental line-by-line encryption.

The project is built around one unusual idea: every line is encrypted independently, and there is deliberately no password-validity check. A wrong Master Password / Key combination therefore produces other characters from the allowed alphabet instead of a "wrong password" message.

> **Important:** EnDeCrypt is an experimental / educational project. It intentionally does not use authenticated encryption and should not be treated as a replacement for established security tools.

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
- persisted vault preferences in `.endecrypt.json`;
- several clock display modes.

## Quick start

Clone the repository:

```bash
git clone git@github.com:f-r-e-d-eth/EnDeCrypt.git
cd EnDeCrypt
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

Start EnDeCrypt:

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
cd ~/EnDeCrypt
source .venv/bin/activate
python3 app.py
```

## Vault folder

By default EnDeCrypt uses:

```text
~/EnDeCrypt/vault
```

Use **CHOOSE FOLDER** in the UI to select another directory.

The last selected vault is remembered in:

```text
~/.config/endecrypt/config.json
```

The selected vault can contain:

- editable text/encrypted files;
- background images such as PNG, JPG, JPEG, WEBP and GIF;
- the automatically created `.endecrypt.json` preference file.

Images and EnDeCrypt support files are not shown as editable documents.

## Preferences

Each vault stores UI preferences in:

```text
.endecrypt.json
```

These include:

- per-file background;
- per-file glass/transparency setting;
- per-file text/file color;
- CRYPT ON/OFF state;
- clock display mode.

The Master Password and Key are **not** stored.

If a configured background image is removed, EnDeCrypt falls back to the dark background.

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

EnDeCrypt creates an empty file in the currently selected vault and selects it.

## CRYPT OFF

With `CRYPT OFF`, EnDeCrypt behaves like a normal text editor.

Changes are written directly as UTF-8 text.

## CRYPT ON

With `CRYPT ON`, the Master Password and Key are combined internally as:

```text
Master Password + "\0" + Key
```

Each line is stored independently in the form:

```text
base64_nonce|ciphertext
```

The current implementation uses:

- PBKDF2-HMAC-SHA256 for password-to-key derivation;
- a 16-byte random nonce per line;
- HMAC-SHA256 based keystream generation;
- modular arithmetic over the restricted EnDeCrypt character alphabet.

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

The repository still contains `EnDeCrypt.py`, the original command-line prototype used to develop and test the line-based encryption concept.

The Flask application in `app.py` is now the primary interface.

## Development branches

The working GUI application was developed on:

```text
feature/real-app
```

The earlier visual prototype is preserved on:

```text
feature/gui-mockup
```

Once the tested `feature/real-app` branch is merged, `main` should be considered the normal starting point for future development.
