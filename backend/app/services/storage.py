import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import StoredDocument

# (magic bytes, extension, media type)
_SIGNATURES = [
    (b"%PDF-", ".pdf", "application/pdf"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
]
_MEDIA_TYPES = {ext: media for _, ext, media in _SIGNATURES}
_MEDIA_TYPES[".webp"] = "image/webp"


def _root() -> Path:
    return Path(settings.upload_dir).resolve()


def _detect_type(data: bytes) -> tuple[str, str] | None:
    for sig, ext, media in _SIGNATURES:
        if data.startswith(sig):
            return ext, media
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


def save_document(upload: UploadFile, owner_id: int, kind: str, db: Session | None = None) -> str:
    """Validate (size + real file type) and persist an upload.

    Stores in PostgreSQL (`stored_documents`) when a DB session is provided so serverless hosts
    like Vercel (read-only/ephemeral disk) persist documents permanently across cold starts.
    Also writes to disk when not running on Vercel so local/test filesystem assertions work.
    """
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = upload.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(422, f"The {kind} document is empty.")
    if len(data) > max_bytes:
        raise HTTPException(413, f"The {kind} document exceeds the {settings.max_upload_mb} MB limit.")
    detected = _detect_type(data)
    if detected is None:
        raise HTTPException(415, f"The {kind} document must be a PDF, JPEG, PNG or WebP file.")
    ext, media_type = detected

    rel = (Path(str(owner_id)) / f"{kind}_{uuid.uuid4().hex}{ext}").as_posix()

    if db is not None:
        db.add(StoredDocument(key=rel, media_type=media_type, data=data))

    if not os.getenv("VERCEL"):
        try:
            dest = _root() / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        except OSError:
            # Read-only filesystem fallback: DB copy is already staged when db is provided
            if db is None:
                fallback = Path("/tmp/uploads") / rel
                fallback.parent.mkdir(parents=True, exist_ok=True)
                fallback.write_bytes(data)

    return rel


def resolve_document(rel: str) -> tuple[Path, str]:
    root = _root()
    path = (root / rel).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "Document not found.")
    return path, _MEDIA_TYPES.get(path.suffix, "application/octet-stream")


def read_document_bytes(rel: str, db: Session | None = None) -> tuple[bytes, str]:
    if db is not None:
        doc = db.get(StoredDocument, rel)
        if doc is not None:
            return doc.data, doc.media_type
    path, media_type = resolve_document(rel)
    return path.read_bytes(), media_type


def delete_document(rel: str | None, db: Session | None = None) -> None:
    if not rel:
        return
    if db is not None:
        doc = db.get(StoredDocument, rel)
        if doc is not None:
            db.delete(doc)
    try:
        path = (_root() / rel).resolve()
        if _root() in path.parents:
            path.unlink(missing_ok=True)
    except OSError:
        pass
