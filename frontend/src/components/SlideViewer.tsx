import type { SlideData } from "../services/api";

interface SlideViewerProps {
  slides: SlideData[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isRecording: boolean;
  notes: Record<number, string>;
  processingSlides: Set<number>;
}

export function SlideViewer({
  slides,
  currentIndex,
  onNavigate,
  isRecording,
  notes,
  processingSlides,
}: SlideViewerProps) {
  const currentSlide = slides[currentIndex];
  const backendBase = "http://localhost:8000";

  return (
    <div className="slide-viewer">
      <div className="slide-main">
        {currentSlide?.imageUrl ? (
          <img
            src={`${backendBase}${currentSlide.imageUrl}`}
            alt={`Slide ${currentIndex + 1}`}
            className="slide-image"
          />
        ) : (
          <div className="slide-placeholder">
            <div className="slide-text-content">
              {currentSlide?.text || "（テキストなし）"}
            </div>
          </div>
        )}
        <div className="slide-number">
          {currentIndex + 1} / {slides.length}
        </div>
      </div>

      <div className="slide-nav">
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="nav-button"
        >
          ← 前へ
        </button>
        {isRecording && <span className="recording-badge">● 録音中</span>}
        <button
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex === slides.length - 1}
          className="nav-button"
        >
          次へ →
        </button>
      </div>

      <div className="slide-thumbnails">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`thumbnail ${i === currentIndex ? "active" : ""} ${
              notes[i] ? "has-note" : ""
            } ${processingSlides.has(i) ? "processing" : ""}`}
            onClick={() => onNavigate(i)}
          >
            <span className="thumbnail-number">{i + 1}</span>
            {notes[i] && <span className="thumbnail-check">✓</span>}
            {processingSlides.has(i) && (
              <span className="thumbnail-spinner">⟳</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
