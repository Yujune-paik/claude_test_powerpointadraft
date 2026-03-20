from openai import OpenAI


def transcribe_audio(audio_path: str, api_key: str, language: str = "ja") -> str:
    """Transcribe audio file using OpenAI Whisper API."""
    client = OpenAI(api_key=api_key)

    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format="text",
        )

    return transcript
