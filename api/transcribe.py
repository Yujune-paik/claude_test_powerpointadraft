import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    slide_index: int = Form(...),
    api_key: str = Form(...),
    language: str = Form("ja"),
):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        client = OpenAI(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="text",
            )

        return {
            "slideIndex": slide_index,
            "transcript": transcript,
        }
    finally:
        os.unlink(tmp_path)
