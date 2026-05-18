# Household Finance Scaffold

This repository currently contains:

- a **Next.js scaffold** for the future self-hosted household finance app
- a **Python FinTS spike** for testing DKB connectivity before deeper backend work

## Current focus

Before building the full importer, validate that DKB access works reliably via FinTS/HBCI.

## Run the DKB connection test

1. Use the Hermes repo virtualenv because `python-fints` is currently installed there.
2. Copy `.env.dkb.local.example` to `.env.dkb.local` and fill in your DKB credentials.
3. Run:

```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
source /home/pi/.hermes/hermes-agent/venv/bin/activate
python scripts/dkb_connection_test.py
```

The script will:
- bootstrap available TAN mechanisms
- list discovered accounts
- fetch balances
- try to fetch recent transactions
- prompt for a TAN if required

## Python tests for the spike

```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
source /home/pi/.hermes/hermes-agent/venv/bin/activate
pytest banking_spike/tests -q
```

## Notes

- The DKB endpoint is currently configured as `https://banking-dkb.s-fints-pt-dkb.de/fints30`.
- A previous probe confirmed this endpoint responds over HTTPS from this machine.
- If DKB blocks or rejects the FinTS path, the fallback for MVP will be DKB export import (CSV/manual ingestion) using the same downstream transaction pipeline.
