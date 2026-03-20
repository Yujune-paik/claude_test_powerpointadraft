import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.whisper_service import transcribe_audio

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    slide_index: int = Form(...),
    api_key: str = Form(...),
    language: str = Form("ja"),
):
    """Transcribe audio for a specific slide."""
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")

    # Save audio file
    audio_filename = f"slide_{slide_index}_{uuid.uuid4().hex[:8]}.webm"
    audio_path = os.path.join(session_dir, audio_filename)
    with open(audio_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    # Transcribe
    transcript = transcribe_audio(audio_path, api_key, language)

    return {
        "slideIndex": slide_index,
        "transcript": transcript,
    }
