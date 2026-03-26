from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

OUTPUT_DIR = Path(__file__).resolve().parent
JSON_PATH = OUTPUT_DIR / "synthetic_logs.json"
CSV_PATH = OUTPUT_DIR / "synthetic_logs.csv"

COUNTS = {
    "normal": 7000,
    "brute_force": 800,
    "ddos": 600,
    "sql_injection": 500,
    "data_exfiltration": 600,
    "credential_stuffing": 500,
}

SERVICES = [
    "voter-auth-api",
    "aadhaar-verify-service",
    "election-commission-api",
    "rti-portal",
    "municipal-portal",
]

SERVICE_ENDPOINTS = {
    "voter-auth-api": ["/auth/login", "/auth/otp", "/voter/profile", "/health"],
    "aadhaar-verify-service": ["/aadhaar/verify", "/aadhaar/token", "/aadhaar/status"],
    "election-commission-api": ["/eci/results", "/eci/booth/info", "/eci/candidate/list"],
    "rti-portal": ["/rti/login", "/rti/filing", "/rti/status"],
    "municipal-portal": ["/municipal/tax/pay", "/municipal/property", "/municipal/dashboard"],
}

USER_AGENTS = [
    "Mozilla/5.0",
    "CitizenServiceApp/3.1",
    "GovPortalClient/2.0",
    "Android WebView",
    "iOS Safari",
]


def ts(base: datetime, delta_seconds: float) -> str:
    return (base + timedelta(seconds=float(delta_seconds))).isoformat()


def normal_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []
    service_probs = np.array([0.30, 0.22, 0.14, 0.18, 0.16])

    statuses = [200, 200, 200, 200, 201, 401, 403, 404, 429, 500]
    status_probs = [0.62, 0.10, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02, 0.02, 0.01]

    for _ in range(COUNTS["normal"]):
        service = str(rng.choice(SERVICES, p=service_probs))
        endpoint = str(rng.choice(SERVICE_ENDPOINTS[service]))
        status = int(rng.choice(statuses, p=status_probs))
        method = "POST" if any(x in endpoint for x in ["login", "verify", "token", "pay", "filing"]) else "GET"

        logs.append(
            {
                "timestamp": ts(base, rng.uniform(-86400, 0)),
                "source_ip": f"10.{rng.integers(0, 255)}.{rng.integers(0, 255)}.{rng.integers(1, 255)}",
                "endpoint": endpoint,
                "status_code": status,
                "method": method,
                "user_agent": str(rng.choice(USER_AGENTS)),
                "response_time": float(np.clip(rng.lognormal(mean=4.5, sigma=0.35), 20, 2500)),
                "bytes_sent": int(np.clip(rng.lognormal(mean=8.6, sigma=0.9), 300, 4_000_000)),
                "source": service,
                "service": service,
                "pattern": "normal",
            }
        )

    return logs


def brute_force_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []
    attacker_ip = "203.0.113.71"

    for i in range(COUNTS["brute_force"]):
        logs.append(
            {
                "timestamp": ts(base, i * rng.uniform(0.2, 1.0)),
                "source_ip": attacker_ip,
                "endpoint": "/auth/login",
                "status_code": int(rng.choice([401, 403], p=[0.92, 0.08])),
                "method": "POST",
                "user_agent": "CredentialSpray/9.2",
                "response_time": float(rng.uniform(60, 280)),
                "bytes_sent": int(rng.integers(600, 2400)),
                "source": "voter-auth-api",
                "service": "voter-auth-api",
                "pattern": "brute_force",
            }
        )

    return logs


def ddos_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []

    for i in range(COUNTS["ddos"]):
        logs.append(
            {
                "timestamp": ts(base, i * rng.uniform(0.01, 0.08)),
                "source_ip": f"198.51.{rng.integers(0, 255)}.{rng.integers(1, 255)}",
                "endpoint": "/municipal/dashboard",
                "status_code": int(rng.choice([429, 503, 504], p=[0.55, 0.35, 0.10])),
                "method": "GET",
                "user_agent": "FloodBot/4.7",
                "response_time": float(rng.uniform(300, 3000)),
                "bytes_sent": int(rng.integers(300, 2500)),
                "source": "municipal-portal",
                "service": "municipal-portal",
                "pattern": "ddos",
            }
        )

    return logs


def sql_injection_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []
    payloads = [
        "1 UNION SELECT password FROM users",
        "1'; DROP TABLE voters;--",
        "admin' OR '1'='1",
        "1%27%20UNION%20SELECT",
    ]

    for i in range(COUNTS["sql_injection"]):
        logs.append(
            {
                "timestamp": ts(base, i * rng.uniform(0.5, 2.0)),
                "source_ip": f"45.33.{rng.integers(0, 255)}.{rng.integers(1, 255)}",
                "endpoint": f"/rti/search?q={str(rng.choice(payloads))}",
                "status_code": int(rng.choice([400, 403, 500], p=[0.45, 0.35, 0.20])),
                "method": "GET",
                "user_agent": "SQLProbe/2.0",
                "response_time": float(rng.uniform(120, 1200)),
                "bytes_sent": int(rng.integers(700, 12000)),
                "source": "rti-portal",
                "service": "rti-portal",
                "pattern": "sql_injection",
            }
        )

    return logs


def data_exfiltration_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []

    for i in range(COUNTS["data_exfiltration"]):
        logs.append(
            {
                "timestamp": ts(base, i * rng.uniform(2.0, 8.0)),
                "source_ip": "172.16.88.23",
                "endpoint": f"/eci/export?chunk={i}",
                "status_code": 200,
                "method": "GET",
                "user_agent": "BulkDownloader/6.5",
                "response_time": float(rng.uniform(180, 950)),
                "bytes_sent": int(rng.integers(2_000_000, 20_000_000)),
                "source": "election-commission-api",
                "service": "election-commission-api",
                "pattern": "data_exfiltration",
            }
        )

    return logs


def credential_stuffing_logs(rng: np.random.Generator, base: datetime) -> list[dict]:
    logs: list[dict] = []

    for i in range(COUNTS["credential_stuffing"]):
        logs.append(
            {
                "timestamp": ts(base, i * rng.uniform(0.2, 1.2)),
                "source_ip": f"203.0.{rng.integers(0, 255)}.{rng.integers(1, 255)}",
                "endpoint": "/aadhaar/auth/login",
                "status_code": int(rng.choice([401, 403, 200], p=[0.78, 0.17, 0.05])),
                "method": "POST",
                "user_agent": "CredentialSpray/5.1",
                "response_time": float(rng.uniform(70, 450)),
                "bytes_sent": int(rng.integers(700, 4000)),
                "source": "aadhaar-verify-service",
                "service": "aadhaar-verify-service",
                "pattern": "credential_stuffing",
            }
        )

    return logs


def generate() -> list[dict]:
    rng = np.random.default_rng(42)
    base = datetime.now(timezone.utc)

    logs: list[dict] = []
    logs.extend(normal_logs(rng, base - timedelta(hours=24)))
    logs.extend(brute_force_logs(rng, base - timedelta(hours=6)))
    logs.extend(ddos_logs(rng, base - timedelta(hours=5)))
    logs.extend(sql_injection_logs(rng, base - timedelta(hours=4)))
    logs.extend(data_exfiltration_logs(rng, base - timedelta(hours=3)))
    logs.extend(credential_stuffing_logs(rng, base - timedelta(hours=2)))

    rng.shuffle(logs)
    return logs


def main() -> None:
    logs = generate()
    pd.DataFrame(logs).to_csv(CSV_PATH, index=False)
    JSON_PATH.write_text(json.dumps(logs, indent=2))

    print(f"Generated total logs: {len(logs)}")
    print(f"CSV: {CSV_PATH}")
    print(f"JSON: {JSON_PATH}")
    print(f"Pattern counts: {COUNTS}")


if __name__ == "__main__":
    main()
