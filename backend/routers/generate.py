from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.gpt_service import generate_speaker_note

router = APIRouter()


class GenerateRequest(BaseModel):
    slide_text: str
    transcript: str
    api_key: str
    model: str = "gpt-4o"


@router.post("/generate-notes")
async def generate_notes(request: GenerateRequest):
    """Generate speaker notes from slide text and transcript."""
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    note = generate_speaker_note(
        slide_text=request.slide_text,
        transcript=request.transcript,
        api_key=request.api_key,
        model=request.model,
    )

    return {"note": note}
