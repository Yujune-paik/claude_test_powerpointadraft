const API_BASE = "http://localhost:8000/api";

export interface SlideData {
  index: number;
  text: string;
  imageUrl?: string;
}

export interface UploadResponse {
  sessionId: string;
  slideCount: number;
  slides: SlideData[];
}

export interface TranscribeResponse {
  slideIndex: number;
  transcript: string;
}

export interface GenerateNotesResponse {
  note: string;
}

export async function uploadPptx(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function transcribeAudio(
  audioBlob: Blob,
  sessionId: string,
  slideIndex: number,
  apiKey: string,
  language: string = "ja"
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("session_id", sessionId);
  formData.append("slide_index", slideIndex.toString());
  formData.append("api_key", apiKey);
  formData.append("language", language);
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateNotes(
  slideText: string,
  transcript: string,
  apiKey: string,
  model: string = "gpt-4o"
): Promise<GenerateNotesResponse> {
  const res = await fetch(`${API_BASE}/generate-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slide_text: slideText,
      transcript: transcript,
      api_key: apiKey,
      model: model,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportPptx(
  sessionId: string,
  notes: Record<number, string>
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      notes: notes,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
