# DKB connector notes

## Goal
Reach a point where we can perform a real DKB connectivity test from the local machine before committing to the full importer architecture.

## Current chosen path
**Primary spike path:** FinTS/HBCI via `python-fints`.

Rationale:
- works with German banking protocol support
- lower maintenance than browser automation
- gives access to accounts, balances, and transactions if the bank still supports the needed flows
- interactive TAN handling is possible for test purposes

## Current endpoint assumption
The spike is configured to use:

- Bank identifier (BLZ): `12030000`
- Server: `https://banking-dkb.s-fints-pt-dkb.de/fints30`

## Validation done on this machine
- HTTPS probe to `https://banking-dkb.s-fints-pt-dkb.de/fints30` returned `200 OK`
- `python-fints==5.0.0` installed successfully in the Hermes repo virtualenv
- local DKB test harness built under `scratch/household-finance/scripts/dkb_connection_test.py`
- scaffolded env file and README instructions added
- Python spike tests pass (`8 passed`)
- Next.js scaffold builds successfully

## Known risks
1. DKB may require TAN/SCA for flows the library cannot fully satisfy.
2. DKB may have account-type-specific quirks.
3. The `product_id` requirement from `python-fints` may need adjustment if DKB validates it strictly.
4. If DKB rejects automated FinTS access for the required operations, fallback is CSV/export ingestion for MVP.

## Fallback path
If the real test fails for structural reasons, fallback is:
- import DKB exports manually or semi-automatically
- keep the same internal transaction/account schema
- build categories/rules/reporting on top of imported data

## Ready-to-run command
```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
source /home/pi/.hermes/hermes-agent/venv/bin/activate
cp .env.dkb.local.example .env.dkb.local
python scripts/dkb_connection_test.py
```

Or via npm:

```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
npm run dkb:test
```
