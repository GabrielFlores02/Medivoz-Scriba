from __future__ import annotations

import argparse
import os
import shlex
import subprocess
from pathlib import Path

from common import required_env, run_ssh, ssh_base


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy versionado y no destructivo de MediVoz")
    parser.add_argument("--release", required=True, help="Version o identificador de release")
    parser.add_argument("--artifact", default="deploy", help="Directorio local ya construido")
    parser.add_argument("--execute", action="store_true", help="Ejecutar cambios remotos")
    args = parser.parse_args()

    environment = os.getenv("MEDIVOZ_ENV", "").lower()
    if environment not in {"staging", "production"}:
        raise SystemExit("MEDIVOZ_ENV debe ser staging o production")

    artifact = Path(args.artifact).resolve()
    if not artifact.is_dir():
        raise SystemExit(f"No existe el artefacto: {artifact}")
    remote_root = required_env("MEDIVOZ_REMOTE_ROOT")
    safe_release = "".join(character for character in args.release if character.isalnum() or character in ".-_")
    if safe_release != args.release or not safe_release:
        raise SystemExit("Identificador de release invalido")
    remote_release = f"{remote_root}/releases/{safe_release}"

    print(f"Ambiente: {environment}")
    print(f"Artefacto: {artifact}")
    print(f"Release remoto: {remote_release}")
    if not args.execute:
        print("DRY-RUN: no se realizaron cambios. Use --execute despues de crear un backup.")
        return

    run_ssh(f"mkdir -p {shlex.quote(remote_release)}", capture=False)
    scp_command = [
        "scp",
        "-r",
        "-P",
        os.getenv("MEDIVOZ_SSH_PORT", "22"),
        "-i",
        required_env("MEDIVOZ_SSH_KEY_PATH"),
        f"{artifact}{os.sep}.",
        f"{ssh_base()[-1]}:{remote_release}/",
    ]
    subprocess.run(scp_command, check=True)
    run_ssh(
        f"cd {shlex.quote(remote_release)} && docker compose config --quiet && "
        f"docker compose up -d && "
        f"ln -sfn {shlex.quote(remote_release)} {shlex.quote(remote_root + '/current')}",
        capture=False,
    )
    print("Release activado. Ejecute smoke_test.py y documente el resultado.")


if __name__ == "__main__":
    main()
