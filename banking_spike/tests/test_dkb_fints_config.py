from __future__ import annotations

import pytest

from banking_spike.dkb_fints import DkbFinTSConfig, DKB_DEFAULT_BLZ, DKB_DEFAULT_SERVER


def test_from_env_uses_dkb_defaults() -> None:
    config = DkbFinTSConfig.from_env(
        {
            "DKB_FINTS_USER_ID": "demo-user",
            "DKB_FINTS_PIN": "super-secret",
            "DKB_FINTS_PRODUCT_ID": "household-finance-test",
        }
    )

    assert config.bank_identifier == DKB_DEFAULT_BLZ
    assert config.server == DKB_DEFAULT_SERVER
    assert config.customer_id == "demo-user"
    assert config.days == 30


def test_from_env_supports_overrides() -> None:
    config = DkbFinTSConfig.from_env(
        {
            "DKB_FINTS_BANK_IDENTIFIER": "99999999",
            "DKB_FINTS_SERVER": "https://example.invalid/fints",
            "DKB_FINTS_USER_ID": "demo-user",
            "DKB_FINTS_CUSTOMER_ID": "customer-123",
            "DKB_FINTS_PIN": "super-secret",
            "DKB_FINTS_PRODUCT_ID": "household-finance-test",
            "DKB_FINTS_DAYS": "14",
        }
    )

    assert config.bank_identifier == "99999999"
    assert config.server == "https://example.invalid/fints"
    assert config.customer_id == "customer-123"
    assert config.days == 14


@pytest.mark.parametrize(
    "missing_key",
    ["DKB_FINTS_USER_ID", "DKB_FINTS_PIN", "DKB_FINTS_PRODUCT_ID"],
)
def test_from_env_requires_core_settings(missing_key: str) -> None:
    env = {
        "DKB_FINTS_USER_ID": "demo-user",
        "DKB_FINTS_PIN": "super-secret",
        "DKB_FINTS_PRODUCT_ID": "household-finance-test",
    }
    env.pop(missing_key)

    with pytest.raises(ValueError, match=missing_key):
        DkbFinTSConfig.from_env(env)


def test_redacted_summary_masks_sensitive_values() -> None:
    config = DkbFinTSConfig.from_env(
        {
            "DKB_FINTS_USER_ID": "demo-user",
            "DKB_FINTS_PIN": "super-secret",
            "DKB_FINTS_PRODUCT_ID": "household-finance-test",
        }
    )

    summary = config.redacted_summary()

    assert summary["user_id"] == "de***er"
    assert summary["pin"] == "***"
    assert summary["server"] == DKB_DEFAULT_SERVER
    assert summary["product_id"] == "household-finance-test"
