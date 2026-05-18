from __future__ import annotations

from pathlib import Path

from banking_spike.dkb_fints import load_simple_env_file


def test_load_simple_env_file_reads_key_values(tmp_path: Path) -> None:
    env_file = tmp_path / ".env.dkb.local"
    env_file.write_text(
        "# comment\n"
        "DKB_FINTS_USER_ID=test-user\n"
        "DKB_FINTS_PIN=secret\n"
        "DKB_FINTS_PRODUCT_ID=household-finance\n",
        encoding="utf-8",
    )

    loaded = load_simple_env_file(env_file)

    assert loaded == {
        "DKB_FINTS_USER_ID": "test-user",
        "DKB_FINTS_PIN": "secret",
        "DKB_FINTS_PRODUCT_ID": "household-finance",
    }


def test_load_simple_env_file_ignores_missing_file(tmp_path: Path) -> None:
    loaded = load_simple_env_file(tmp_path / "missing.env")

    assert loaded == {}
