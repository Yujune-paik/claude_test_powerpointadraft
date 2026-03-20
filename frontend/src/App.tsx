import { useState, useCallback } from "react";
import { FileUpload } from "./components/FileUpload";
import { SlideViewer } from "./components/SlideViewer";
import { NotesPanel } from "./components/NotesPanel";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import type { SlideData } from "./services/api";
import {
  authenticate,
  uploadPptx,
  transcribeAudio,
  generateNotes,
  exportPptx,
} from "./services/api";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
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

  const handleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await authenticate(password);
      if (result.ok) {
        setIsAuthenticated(true);
      } else {
        setAuthError(result.error || "パスワードが違います");
      }
    } catch (e) {
      setAuthError(`認証に失敗しました: ${e}`);
    } finally {
      setAuthLoading(false);
    }
  }, [password]);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadPptx(file);
      setPptxFile(file);
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
      setProcessingSlides((prev) => new Set(prev).add(slideIndex));
      try {
        const { transcript } = await transcribeAudio(
          audioBlob,
          slideIndex
        );
        setTranscripts((prev) => ({ ...prev, [slideIndex]: transcript }));

        const slideText = slides[slideIndex]?.text || "";
        const { note } = await generateNotes(slideText, transcript);
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
    [slides]
  );

  const handleNavigate = useCallback(
    async (newIndex: number) => {
      if (newIndex < 0 || newIndex >= slides.length) return;

      if (isRecording && recordingSlideIndex !== null) {
        const blob = await splitRecording();
        if (blob) {
          processSlideAudio(blob, recordingSlideIndex);
        }
        setRecordingSlideIndex(newIndex);
      } else {
        try {
          await startRecording();
          setRecordingSlideIndex(newIndex);
          setError(null);
        } catch (e) {
          setError(`マイクへのアクセスに失敗しました: ${e}`);
        }
      }

      setCurrentIndex(newIndex);
    },
    [
      slides.length,
      isRecording,
      recordingSlideIndex,
      splitRecording,
      startRecording,
      processSlideAudio,
    ]
  );

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (blob && recordingSlideIndex !== null) {
      processSlideAudio(blob, recordingSlideIndex);
    }
    setRecordingSlideIndex(null);
  }, [stopRecording, recordingSlideIndex, processSlideAudio]);

  const handleRerecord = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
    try {
      await startRecording();
      setRecordingSlideIndex(currentIndex);
      setTranscripts((prev) => {
        const next = { ...prev };
        delete next[currentIndex];
        return next;
      });
      setNotes((prev) => {
        const next = { ...prev };
        delete next[currentIndex];
        return next;
      });
      setError(null);
    } catch (e) {
      setError(`マイクへのアクセスに失敗しました: ${e}`);
    }
  }, [isRecording, stopRecording, startRecording, currentIndex]);

  const handleExport = useCallback(async () => {
    if (!pptxFile) return;
    if (isRecording && recordingSlideIndex !== null) {
      const blob = await stopRecording();
      if (blob) {
        await processSlideAudio(blob, recordingSlideIndex);
      }
      setRecordingSlideIndex(null);
    }
    try {
      const blob = await exportPptx(pptxFile, notes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presentation_with_notes.pptx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`エクスポートに失敗しました: ${e}`);
    }
  }, [pptxFile, notes, isRecording, recordingSlideIndex, stopRecording, processSlideAudio]);

  // Password gate
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-screen">
          <h1>Auto Speaker Notes</h1>
          <p>パスワードを入力してください</p>
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={authLoading || !password}>
              {authLoading ? "確認中..." : "ログイン"}
            </button>
          </form>
          {authError && <p className="login-error">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Auto Speaker Notes</h1>
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
                {isRecording && (
                  <>
                    <button
                      className="btn-stop"
                      onClick={handleStopRecording}
                    >
                      ■ 発表終了（録音停止）
                    </button>
                    <button
                      className="btn-rerecord"
                      onClick={handleRerecord}
                    >
                      ↻ このスライドを録音し直す
                    </button>
                  </>
                )}

                {Object.keys(notes).length > 0 && (
                  <button className="btn-export" onClick={handleExport}>
                    ⬇ ノート付きPPTXをダウンロード
                  </button>
                )}

                <button
                  className="btn-reset"
                  onClick={() => {
                    if (isRecording) {
                      stopRecording();
                    }
                    setSessionId(null);
                    setPptxFile(null);
                    setSlides([]);
                    setNotes({});
                    setTranscripts({});
                    setRecordingSlideIndex(null);
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
