from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from common import redact, run_ssh


READ_ONLY_CHECKS = {
    "Sistema": "uname -a && uptime",
    "Disco": "df -h",
    "Memoria": "free -h",
    "Contenedores": "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'",
    "Redes Docker": "docker network ls",
    "Healthchecks": (
        "docker inspect --format '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}"
        "{{else}}{{.State.Status}}{{end}}' $(docker ps -q)"
    ),
}


def main() -> None:
    report_dir = Path(__file__).resolve().parents[1] / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    report_path = report_dir / f"vps_audit_{timestamp:%Y%m%d_%H%M%S}.md"

    sections = [
        "# Auditoria VPS MediVoz",
        "",
        f"Fecha UTC: {timestamp.isoformat()}",
        "",
        "Auditoria de solo lectura. Los valores sensibles se redactan.",
    ]
    for title, command in READ_ONLY_CHECKS.items():
        result = run_ssh(command)
        sections.extend(
            ["", f"## {title}", "", "```text", redact(result.stdout.strip()), "```"]
        )

    report_path.write_text("\n".join(sections) + "\n", encoding="utf-8")
    print(f"Reporte creado: {report_path}")


if __name__ == "__main__":
    main()
