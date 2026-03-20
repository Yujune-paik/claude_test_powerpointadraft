import os
import uuid
import subprocess
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.pptx_service import extract_slides

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.post("/upload")
async def upload_pptx(file: UploadFile = File(...)):
    """Upload a PPTX file and extract slide data."""
    if not file.filename.endswith((".pptx", ".PPTX")):
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    pptx_path = os.path.join(session_dir, "presentation.pptx")
    with open(pptx_path, "wb") as f:
        content = await file.read()
        f.write(content)

    slides_dir = os.path.join(session_dir, "slides")
    os.makedirs(slides_dir, exist_ok=True)

    # Extract slide text
    slides_data = extract_slides(pptx_path, slides_dir)

    # Convert slides to images using LibreOffice
    slide_images = _convert_to_images(pptx_path, slides_dir, session_id)
    for slide in slides_data:
        if slide["index"] < len(slide_images):
            slide["imageUrl"] = slide_images[slide["index"]]

    return {
        "sessionId": session_id,
        "slideCount": len(slides_data),
        "slides": slides_data,
    }


def _convert_to_images(pptx_path: str, slides_dir: str, session_id: str) -> list[str]:
    """Convert PPTX to PNG images using LibreOffice."""
    try:
        subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to", "png",
                "--outdir", slides_dir,
                pptx_path,
            ],
            capture_output=True,
            timeout=60,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        # LibreOffice not available - return empty list
        return []

    # LibreOffice outputs a single image for single-page docs,
    # or multiple images. Collect them.
    images = []
    # Check for single file output
    single_file = os.path.join(slides_dir, "presentation.png")
    if os.path.exists(single_file):
        images.append(f"/uploads/{session_id}/slides/presentation.png")
        return images

    # Check for numbered outputs
    for i in range(100):
        for pattern in [f"presentation-{i}.png", f"presentation_{i}.png"]:
            path = os.path.join(slides_dir, pattern)
            if os.path.exists(path):
                images.append(f"/uploads/{session_id}/slides/{pattern}")

    return images
