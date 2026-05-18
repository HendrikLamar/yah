from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

DKB_DEFAULT_BLZ = "12030000"
DKB_DEFAULT_SERVER = "https://banking-dkb.s-fints-pt-dkb.de/fints30"
DEFAULT_LOOKBACK_DAYS = 30


@dataclass(slots=True)
class DkbFinTSConfig:
    bank_identifier: str
    server: str
    user_id: str
    customer_id: str
    pin: str
    product_id: str
    product_version: str
    days: int

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "DkbFinTSConfig":
        missing = [
            key
            for key in ("DKB_FINTS_USER_ID", "DKB_FINTS_PIN", "DKB_FINTS_PRODUCT_ID")
            if not env.get(key)
        ]
        if missing:
            raise ValueError(f"Missing required env var(s): {', '.join(missing)}")

        user_id = env["DKB_FINTS_USER_ID"].strip()
        customer_id = env.get("DKB_FINTS_CUSTOMER_ID", user_id).strip()

        return cls(
            bank_identifier=env.get("DKB_FINTS_BANK_IDENTIFIER", DKB_DEFAULT_BLZ).strip(),
            server=env.get("DKB_FINTS_SERVER", DKB_DEFAULT_SERVER).strip(),
            user_id=user_id,
            customer_id=customer_id,
            pin=env["DKB_FINTS_PIN"],
            product_id=env["DKB_FINTS_PRODUCT_ID"].strip(),
            product_version=env.get("DKB_FINTS_PRODUCT_VERSION", "0.1.0").strip(),
            days=int(env.get("DKB_FINTS_DAYS", str(DEFAULT_LOOKBACK_DAYS))),
        )

    def redacted_summary(self) -> dict[str, str | int]:
        return {
            "bank_identifier": self.bank_identifier,
            "server": self.server,
            "user_id": _mask(self.user_id),
            "customer_id": _mask(self.customer_id),
            "pin": "***",
            "product_id": self.product_id,
            "product_version": self.product_version,
            "days": self.days,
        }


def load_simple_env_file(path: str | Path) -> dict[str, str]:
    env_path = Path(path)
    if not env_path.exists():
        return {}

    loaded: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        loaded[key.strip()] = value.strip()
    return loaded


def _mask(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}***{value[-2:]}"
