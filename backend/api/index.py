import sys
from pathlib import Path

# Ensure `backend/` is on sys.path when invoked from `backend/api/index.py` on Vercel
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app.models  # noqa: E402, F401
from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402, F401

# Ensure all tables (including stored_documents) exist even if serverless skips lifespan
Base.metadata.create_all(bind=engine)
