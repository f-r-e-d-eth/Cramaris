import base64
import getpass
import hashlib
import hmac
import os


ALPHABET = (
    "0123456789"
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    " +-*/!.,:;()[]{}_?=@#$%&"
)

N = len(ALPHABET)
CHAR_TO_NUM = {c: i for i, c in enumerate(ALPHABET)}
NUM_TO_CHAR = {i: c for i, c in enumerate(ALPHABET)}


def password_to_key(password):
    """Derive a 32-byte key from the password."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        b"LineCipherExperiment-v1",
        200_000,
        dklen=32,
    )


def make_keystream(key, nonce, length):
    """Generate a deterministic pseudo-random byte stream for one line."""
    result = bytearray()
    counter = 0

    while len(result) < length:
        message = nonce + counter.to_bytes(8, "big")
        block = hmac.new(key, message, hashlib.sha256).digest()
        result.extend(block)
        counter += 1

    return result[:length]


def validate_text(text):
    for char in text:
        if char not in CHAR_TO_NUM:
            raise ValueError(f"Unsupported character: {repr(char)}")


def encrypt_line(text, password):
    validate_text(text)

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
    line = line.rstrip("\n")

    if not line:
        return ""

    nonce_text, encrypted = line.split("|", 1)
    nonce = base64.urlsafe_b64decode(nonce_text.encode("ascii"))

    key = password_to_key(password)
    stream = make_keystream(key, nonce, len(encrypted))

    decrypted = []

    for char, random_byte in zip(encrypted, stream):
        encrypted_number = CHAR_TO_NUM[char]
        key_number = random_byte % N
        plain_number = (encrypted_number - key_number) % N
        decrypted.append(NUM_TO_CHAR[plain_number])

    return "".join(decrypted)


def view_file(filename, password, show_line_numbers=True):
    with open(filename, "r", encoding="ascii") as file:
        lines = file.readlines()

    for i, line in enumerate(lines, start=1):
        decrypted = decrypt_line(line, password)

        if show_line_numbers:
            print(f"{i:3}: {decrypted}")
        else:
            print(decrypted)


def append_line(filename, password, text):
    encrypted = encrypt_line(text, password)

    with open(filename, "a", encoding="ascii") as file:
        file.write(encrypted + "\n")


def edit_line(filename, password):
    with open(filename, "r", encoding="ascii") as file:
        encrypted_lines = file.readlines()

    print()
    for i, line in enumerate(encrypted_lines, start=1):
        print(f"{i:3}: {decrypt_line(line, password)}")
    print()

    try:
        line_number = int(input("Line to change: "))
    except ValueError:
        print("Invalid line number.")
        return

    if line_number < 1 or line_number > len(encrypted_lines):
        print("Invalid line number.")
        return

    new_text = input("New text: ")
    new_encrypted_line = encrypt_line(new_text, password)
    encrypted_lines[line_number - 1] = new_encrypted_line + "\n"

    with open(filename, "w", encoding="ascii") as file:
        file.writelines(encrypted_lines)

    print("Line updated.")


def get_files():
    files = []

    for name in os.listdir("."):
        if not os.path.isfile(name):
            continue

        if name.lower().endswith(".py"):
            continue

        files.append(name)

    return sorted(files)


def show_menu(files):
    print("\nFiles:\n")

    for i, filename in enumerate(files, start=1):
        print(f"{i:3} : {filename}")

    print("\nCommands:")
    print("  v = view")
    print("  e = edit")
    print("  a = append")
    print("  q = quit")
    print()
    print("Examples:")
    print("  2v   -> view file 2")
    print("  1e   -> edit file 1")
    print("  3a   -> append to file 3")
    print()


def main():
    while True:
        files = get_files()

        if not files:
            print("No encrypted files found in the current folder.")
            return

        show_menu(files)
        command = input("Command: ").strip().lower()

        if command == "q":
            break

        if len(command) < 2:
            print("Invalid command.")
            continue

        action = command[-1]
        number_text = command[:-1]

        if action not in ("v", "e", "a"):
            print("Unknown action.")
            continue

        try:
            file_number = int(number_text)
        except ValueError:
            print("Invalid file number.")
            continue

        if file_number < 1 or file_number > len(files):
            print("File number out of range.")
            continue

        filename = files[file_number - 1]
        password = getpass.getpass("Password: ")

        print()

        try:
            if action == "v":
                view_file(filename, password)

            elif action == "e":
                edit_line(filename, password)

            elif action == "a":
                print("Current content with this password:\n")
                view_file(filename, password)
                print()

                text = input("New text: ")
                append_line(filename, password, text)

                print("\nLine appended.")

        except (ValueError, UnicodeError) as error:
            print(f"Error: {error}")

        print()
        input("Press Enter to continue...")


if __name__ == "__main__":
    main()
