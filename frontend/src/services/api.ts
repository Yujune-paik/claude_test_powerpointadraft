const API_BASE = "/api";

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

export async function authenticate(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  slideIndex: number,
  language: string = "ja"
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("slide_index", slideIndex.toString());
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
  model: string = "gpt-4o"
): Promise<GenerateNotesResponse> {
  const res = await fetch(`${API_BASE}/generate-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slide_text: slideText,
      transcript: transcript,
      model: model,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportPptx(
  pptxFile: File,
  notes: Record<number, string>
): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", pptxFile);
  formData.append("notes", JSON.stringify(notes));
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
