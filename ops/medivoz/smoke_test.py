from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from common import required_env


def request_json(url: str, *, method: str = "GET", payload: dict | None = None, token: str | None = None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def main() -> None:
    base_url = required_env("MEDIVOZ_BASE_URL").rstrip("/")
    api_url = os.getenv("MEDIVOZ_API_URL", f"{base_url}/api/v1").rstrip("/")

    status, health = request_json(f"{base_url}/health")
    if status != 200 or health.get("status") != "ok":
        raise SystemExit("Healthcheck API fallo")
    print("OK health")

    email = os.getenv("MEDIVOZ_QA_EMAIL", "").strip()
    password = os.getenv("MEDIVOZ_QA_PASSWORD", "").strip()
    if not email or not password:
        print("SKIP login y endpoints autenticados: faltan credenciales QA")
        return

    _, login = request_json(
        f"{api_url}/auth/login",
        method="POST",
        payload={"email": email, "password": password},
    )
    token = login.get("accessToken")
    if not token:
        raise SystemExit("Login QA no devolvio access token")
    print("OK login")

    status, protocol = request_json(f"{api_url}/study/protocols/active", token=token)
    if status != 200 or protocol.get("estado") != "activo":
        raise SystemExit("No existe protocolo activo")
    print("OK protocolo activo")

    status, dashboard = request_json(f"{api_url}/study/dashboard", token=token)
    if status != 200 or "progresoEspecialidad" not in dashboard:
        raise SystemExit("Dashboard de estudio no responde correctamente")
    print("OK dashboard")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {error.code}: {detail[:300]}") from error
