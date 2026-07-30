from __future__ import annotations

import os
import shlex
from datetime import datetime, timezone

from common import required_env, run_ssh


def main() -> None:
    if os.getenv("MEDIVOZ_ENV", "").lower() not in {"staging", "production"}:
        raise SystemExit("MEDIVOZ_ENV debe ser staging o production")

    container = required_env("MEDIVOZ_POSTGRES_CONTAINER")
    db_user = required_env("MEDIVOZ_DB_USER")
    db_name = required_env("MEDIVOZ_DB_NAME")
    remote_root = required_env("MEDIVOZ_REMOTE_ROOT")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = f"{remote_root}/backups/medivoz_{timestamp}.dump"

    command = (
        f"mkdir -p {shlex.quote(remote_root + '/backups')} && "
        f"docker exec {shlex.quote(container)} pg_dump "
        f"-U {shlex.quote(db_user)} -d {shlex.quote(db_name)} -Fc "
        f"> {shlex.quote(backup_path)} && test -s {shlex.quote(backup_path)}"
    )
    run_ssh(command, capture=False)
    print(f"Backup remoto verificado: {backup_path}")


if __name__ == "__main__":
    main()
