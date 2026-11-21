import sys
from pathlib import Path

# Ensure `backend/` is on sys.path when invoked from `backend/api/index.py` on Vercel
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402, F401
