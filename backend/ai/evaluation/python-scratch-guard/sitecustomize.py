"""Evaluation-only guard preloaded by PYTHONPATH; no connection data is logged."""
import os
import re
import psycopg2

_expected = os.environ.get("SCRATCH_EVAL_DATABASE", "")
if not re.fullmatch(r"travelmate_scratch_\d{17}", _expected):
    raise RuntimeError("SCRATCH_PYTHON_NAME_REJECTED")
_connect = psycopg2.connect


def guarded_connect(*args, **kwargs):
    if args or kwargs.get("database", kwargs.get("dbname")) != _expected:
        raise RuntimeError("SCRATCH_PYTHON_TARGET_REJECTED")
    return _connect(*args, **kwargs)


psycopg2.connect = guarded_connect
