import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

# (magic bytes, extension, media type)
_SIGNATURES = [
    (b"%PDF-", ".pdf", "application/pdf"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
]
_MEDIA_TYPES = {ext: media for _, ext, media in _SIGNATURES}


def _root() -> Path:
    return Path(settings.upload_dir).resolve()


def save_document(upload: UploadFile, owner_id: int, kind: str) -> str:
    """Validate (size + real file type) and store an upload. Returns the relative path."""
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = upload.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(422, f"The {kind} document is empty.")
    if len(data) > max_bytes:
        raise HTTPException(413, f"The {kind} document exceeds the {settings.max_upload_mb} MB limit.")
    ext = next((e for sig, e, _ in _SIGNATURES if data.startswith(sig)), None)
    if ext is None:
        raise HTTPException(415, f"The {kind} document must be a PDF, JPEG or PNG file.")

    rel = Path(str(owner_id)) / f"{kind}_{uuid.uuid4().hex}{ext}"
    dest = _root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return rel.as_posix()


def resolve_document(rel: str) -> tuple[Path, str]:
    root = _root()
    path = (root / rel).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "Document not found.")
    return path, _MEDIA_TYPES.get(path.suffix, "application/octet-stream")


def delete_document(rel: str | None) -> None:
    if not rel:
        return
    path = (_root() / rel).resolve()
    if _root() in path.parents:
        path.unlink(missing_ok=True)
