"""Canonical notification delivery subsystem."""

from .registry import emit_notification, render_notification

__all__ = ["emit_notification", "render_notification"]
