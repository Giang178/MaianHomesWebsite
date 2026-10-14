"""Backward-compatible import path for website idempotency operations."""

from app.modules.website.common.idempotency import execute_mutation_once, execute_once

__all__ = ["execute_once", "execute_mutation_once"]
