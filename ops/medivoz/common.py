from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path


SENSITIVE_PATTERN = re.compile(
    r"(?im)^(\s*(?:password|secret|token|api[_-]?key)\s*[=:]\s*).+$"
)


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Falta la variable de entorno requerida: {name}")
    return value


def ssh_base() -> list[str]:
    host = required_env("MEDIVOZ_SSH_HOST")
    user = required_env("MEDIVOZ_SSH_USER")
    key_path = Path(required_env("MEDIVOZ_SSH_KEY_PATH")).expanduser().resolve()
    if not key_path.is_file():
        raise SystemExit(f"La llave SSH no existe: {key_path}")
    port = os.getenv("MEDIVOZ_SSH_PORT", "22")
    return [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-p",
        port,
        "-i",
        str(key_path),
        f"{user}@{host}",
    ]


def run_ssh(remote_command: str, *, capture: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*ssh_base(), remote_command],
        check=True,
        text=True,
        capture_output=capture,
    )


def redact(value: str) -> str:
    return SENSITIVE_PATTERN.sub(r"\1[REDACTADO]", value)
