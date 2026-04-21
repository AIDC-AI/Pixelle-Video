from datetime import UTC, datetime, timedelta

from web.components.migration_banner import (
    compute_hide_until,
    hide_banner_for_24_hours,
    parse_hide_until,
    should_show_banner,
)


def test_hide_banner_for_24_hours_extends_deadline_by_one_day():
    now = datetime(2026, 4, 22, 1, 0, tzinfo=UTC)

    hide_until = parse_hide_until(hide_banner_for_24_hours(now))

    assert hide_until == now + timedelta(hours=24)


def test_should_show_banner_false_when_session_or_cookie_still_active():
    now = datetime(2026, 4, 22, 1, 0, tzinfo=UTC)
    future_hide_until = compute_hide_until(now).isoformat()

    assert should_show_banner(now, session_value=future_hide_until) is False
    assert should_show_banner(now, cookie_value=future_hide_until) is False


def test_should_show_banner_true_after_deadline_or_invalid_value():
    now = datetime(2026, 4, 22, 1, 0, tzinfo=UTC)
    past_hide_until = (now - timedelta(minutes=1)).isoformat()

    assert should_show_banner(now, session_value=past_hide_until) is True
    assert should_show_banner(now, cookie_value="not-a-date") is True

