import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services.pptx_service import export_with_notes

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


class ExportRequest(BaseModel):
    session_id: str
    notes: dict[int, str]  # {slide_index: note_text}


@router.post("/export")
async def export_pptx(request: ExportRequest):
    """Export PPTX with speaker notes added."""
    session_dir = os.path.join(UPLOAD_DIR, request.session_id)
    pptx_path = os.path.join(session_dir, "presentation.pptx")

    if not os.path.exists(pptx_path):
        raise HTTPException(status_code=404, detail="Presentation not found")

    output_path = os.path.join(session_dir, "presentation_with_notes.pptx")
    export_with_notes(pptx_path, request.notes, output_path)

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename="presentation_with_notes.pptx",
    )
