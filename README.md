# EnDeCrypt

EnDeCrypt is a small experimental Python project for exploring line-by-line text encryption.

The core idea is intentionally unusual:

- each line is encrypted independently;
- every line receives its own random nonce;
- entering a wrong password does **not** produce a password error;
- wrong passwords simply decrypt to other characters from the allowed alphabet;
- different lines in the same file may therefore have been written using different passwords.

> **Important:** This is a learning / thought-experiment project, not a replacement for established encryption tools. It intentionally omits authenticated-encryption checks.

## Current CLI features

Run:

```bash
python EnDeCrypt.py
```

The program lists all files in the current directory except `.py` files.

Commands use the file number followed by an action:

```text
2v  -> view file 2
1e  -> edit a line in file 1
3a  -> append a line to file 3
q   -> quit
```

When appending, EnDeCrypt first displays the file using the entered password so you can visually check that you entered the intended password.

## How the experiment works

Characters are mapped into a restricted alphabet. For each line, a password-derived key and a random nonce generate a pseudo-random keystream. Encryption and decryption use modular arithmetic over the alphabet.

Because every line has its own nonce, identical plaintext lines encrypted with the same password still produce different ciphertext, and lines can be edited independently.

## Requirements

- Python 3
- `cryptography`

Install the dependency with:

```bash
python -m pip install -r requirements.txt
```

## Planned direction

The next milestone is a local browser interface with:

- password field at the top;
- selectable encrypted files on the left;
- live decrypted text view;
- append/edit/new-file actions;
- cyberpunk-inspired styling.

The files stay local; the browser UI will communicate with a small local Python backend.
