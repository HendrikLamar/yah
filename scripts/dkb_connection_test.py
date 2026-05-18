#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fints.client import FinTS3PinTanClient, NeedTANResponse
from fints.utils import minimal_interactive_cli_bootstrap

from banking_spike.dkb_fints import DkbFinTSConfig, load_simple_env_file

DEFAULT_ENV_FILE = PROJECT_ROOT / ".env.dkb.local"


def main() -> int:
    env = dict(os.environ)
    env.update(load_simple_env_file(DEFAULT_ENV_FILE))

    try:
        config = DkbFinTSConfig.from_env(env)
    except ValueError as exc:
        print("Missing DKB FinTS configuration.", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        print(f"Copy {PROJECT_ROOT / '.env.dkb.local.example'} to {DEFAULT_ENV_FILE} and fill it in.", file=sys.stderr)
        return 2

    print("== DKB FinTS connection test ==")
    print("Using config:")
    for key, value in config.redacted_summary().items():
        print(f"  - {key}: {value}")
    print()

    client = FinTS3PinTanClient(
        config.bank_identifier,
        config.user_id,
        config.pin,
        config.server,
        customer_id=config.customer_id,
        product_id=config.product_id,
        product_version=config.product_version,
    )

    try:
        with client:
            minimal_interactive_cli_bootstrap(client)
            info = client.get_information()
            print(f"Connected bank: {info.get('bank', {}).get('name', 'unknown')}")
            auth = info.get("auth", {})
            print(f"Current TAN mechanism: {auth.get('current_tan_mechanism')}")
            print(f"Supported TAN mechanisms: {list(auth.get('tan_mechanisms', {}).keys())}")
            print()

            accounts = _resolve_if_tan_needed(client, client.get_sepa_accounts())
            print(f"Discovered {len(accounts)} account(s).")

            start_date = date.today() - timedelta(days=config.days)
            for account in accounts:
                print("\n-- Account --")
                print(f"IBAN: {getattr(account, 'iban', 'n/a')}")
                print(f"Account number: {getattr(account, 'accountnumber', 'n/a')}")

                balance = _resolve_if_tan_needed(client, client.get_balance(account))
                if balance is not None:
                    print(f"Booked balance: {getattr(balance, 'amount', balance)}")

                transactions = _resolve_if_tan_needed(
                    client,
                    client.get_transactions(account, start_date=start_date, end_date=date.today()),
                )
                if transactions is None:
                    print("Transactions: unavailable")
                    continue

                print(f"Transactions fetched ({config.days} day window): {len(transactions)}")
                for tx in transactions[:5]:
                    tx_data = getattr(tx, 'data', {}) or {}
                    amount = tx_data.get('amount') if isinstance(tx_data, dict) else None
                    purpose = tx_data.get('purpose') if isinstance(tx_data, dict) else None
                    booking_date = getattr(tx, 'date', None)
                    print(f"  - {booking_date} | {amount} | {purpose}")

        print("\nDKB FinTS connection test completed.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print("\nDKB FinTS connection test failed.", file=sys.stderr)
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


def _resolve_if_tan_needed(client: FinTS3PinTanClient, result: Any) -> Any:
    while isinstance(result, NeedTANResponse):
        print("\nA TAN confirmation is required.")
        if result.challenge:
            print(f"Challenge: {result.challenge}")
        if result.decoupled:
            tan = input("Approve the request in your TAN app, then press Enter here to continue: ")
        else:
            tan = input("Enter TAN: ")
        result = client.send_tan(result, tan)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
