import os
import io
import base64
from pptx import Presentation
from pptx.util import Inches
from PIL import Image


def extract_slides(pptx_path: str, output_dir: str) -> list[dict]:
    """Extract slide text and generate slide images from a PPTX file."""
    prs = Presentation(pptx_path)
    slides_data = []

    for i, slide in enumerate(prs.slides):
        slide_text = _extract_slide_text(slide)
        slides_data.append({
            "index": i,
            "text": slide_text,
        })

    return slides_data


def _extract_slide_text(slide) -> str:
    """Extract all text from a slide."""
    texts = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            for paragraph in shape.text_frame.paragraphs:
                text = paragraph.text.strip()
                if text:
                    texts.append(text)
        if shape.has_table:
            for row in shape.table.rows:
                for cell in row.cells:
                    text = cell.text.strip()
                    if text:
                        texts.append(text)
    return "\n".join(texts)


def export_with_notes(pptx_path: str, notes: dict[int, str], output_path: str) -> str:
    """Write speaker notes into PPTX and save to output_path."""
    prs = Presentation(pptx_path)

    for slide_index, note_text in notes.items():
        idx = int(slide_index)
        if idx < len(prs.slides):
            slide = prs.slides[idx]
            if not slide.has_notes_slide:
                slide.notes_slide  # creates notes slide
            notes_slide = slide.notes_slide
            notes_slide.notes_text_frame.text = note_text

    prs.save(output_path)
    return output_path


def get_slide_count(pptx_path: str) -> int:
    """Get the number of slides in a PPTX file."""
    prs = Presentation(pptx_path)
    return len(prs.slides)
