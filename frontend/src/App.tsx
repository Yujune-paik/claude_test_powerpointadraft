import { useState, useCallback } from "react";
import { FileUpload } from "./components/FileUpload";
import { SlideViewer } from "./components/SlideViewer";
import { NotesPanel } from "./components/NotesPanel";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import type { SlideData } from "./services/api";
import {
  uploadPptx,
  transcribeAudio,
  generateNotes,
  exportPptx,
} from "./services/api";
import "./App.css";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [processingSlides, setProcessingSlides] = useState<Set<number>>(
    new Set()
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingSlideIndex, setRecordingSlideIndex] = useState<number | null>(
    null
  );

  const { isRecording, startRecording, stopRecording, splitRecording } =
    useAudioRecorder();

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadPptx(file);
      setSessionId(result.sessionId);
      setSlides(result.slides);
      setCurrentIndex(0);
      setNotes({});
      setTranscripts({});
    } catch (e) {
      setError(`アップロードに失敗しました: ${e}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const processSlideAudio = useCallback(
    async (audioBlob: Blob, slideIndex: number) => {
      if (!sessionId || !apiKey) return;

      setProcessingSlides((prev) => new Set(prev).add(slideIndex));
      try {
        // Step 1: Transcribe
        const { transcript } = await transcribeAudio(
          audioBlob,
          sessionId,
          slideIndex,
          apiKey
        );
        setTranscripts((prev) => ({ ...prev, [slideIndex]: transcript }));

        // Step 2: Generate note
        const slideText = slides[slideIndex]?.text || "";
        const { note } = await generateNotes(slideText, transcript, apiKey);
        setNotes((prev) => ({ ...prev, [slideIndex]: note }));
      } catch (e) {
        setError(`スライド${slideIndex + 1}の処理に失敗しました: ${e}`);
      } finally {
        setProcessingSlides((prev) => {
          const next = new Set(prev);
          next.delete(slideIndex);
          return next;
        });
      }
    },
    [sessionId, apiKey, slides]
  );

  const handleStartRecording = useCallback(async () => {
    if (!apiKey) {
      setError("OpenAI APIキーを入力してください");
      return;
    }
    try {
      await startRecording();
      setRecordingSlideIndex(currentIndex);
      setError(null);
    } catch (e) {
      setError(`マイクへのアクセスに失敗しました: ${e}`);
    }
  }, [startRecording, currentIndex, apiKey]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (blob && recordingSlideIndex !== null) {
      processSlideAudio(blob, recordingSlideIndex);
    }
    setRecordingSlideIndex(null);
  }, [stopRecording, recordingSlideIndex, processSlideAudio]);

  const handleNavigate = useCallback(
    async (newIndex: number) => {
      if (newIndex < 0 || newIndex >= slides.length) return;

      // If recording, split audio for current slide and process it
      if (isRecording && recordingSlideIndex !== null) {
        const blob = await splitRecording();
        if (blob) {
          processSlideAudio(blob, recordingSlideIndex);
        }
        setRecordingSlideIndex(newIndex);
      }

      setCurrentIndex(newIndex);
    },
    [
      slides.length,
      isRecording,
      recordingSlideIndex,
      splitRecording,
      processSlideAudio,
    ]
  );

  const handleExport = useCallback(async () => {
    if (!sessionId) return;
    try {
      const blob = await exportPptx(sessionId, notes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presentation_with_notes.pptx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`エクスポートに失敗しました: ${e}`);
    }
  }, [sessionId, notes]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Auto Speaker Notes</h1>
        <div className="api-key-input">
          <input
            type="password"
            placeholder="OpenAI APIキー"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </header>

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <main className="app-main">
        {!sessionId ? (
          <FileUpload onUpload={handleUpload} isLoading={isUploading} />
        ) : (
          <div className="presentation-view">
            <div className="left-panel">
              <SlideViewer
                slides={slides}
                currentIndex={currentIndex}
                onNavigate={handleNavigate}
                isRecording={isRecording}
                notes={notes}
                processingSlides={processingSlides}
              />

              <div className="recording-controls">
                {!isRecording ? (
                  <button
                    className="btn-record"
                    onClick={handleStartRecording}
                  >
                    ● 発表開始（録音）
                  </button>
                ) : (
                  <button
                    className="btn-stop"
                    onClick={handleStopRecording}
                  >
                    ■ 発表終了（録音停止）
                  </button>
                )}

                {Object.keys(notes).length > 0 && (
                  <button className="btn-export" onClick={handleExport}>
                    ⬇ ノート付きPPTXをダウンロード
                  </button>
                )}

                <button
                  className="btn-reset"
                  onClick={() => {
                    setSessionId(null);
                    setSlides([]);
                    setNotes({});
                    setTranscripts({});
                  }}
                >
                  別のファイルを選択
                </button>
              </div>
            </div>

            <div className="right-panel">
              <NotesPanel
                notes={notes}
                transcripts={transcripts}
                currentIndex={currentIndex}
                slideCount={slides.length}
                processingSlides={processingSlides}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
