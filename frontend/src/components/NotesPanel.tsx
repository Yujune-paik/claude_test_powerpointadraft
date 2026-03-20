interface NotesPanelProps {
  notes: Record<number, string>;
  transcripts: Record<number, string>;
  currentIndex: number;
  slideCount: number;
  processingSlides: Set<number>;
}

export function NotesPanel({
  notes,
  transcripts,
  currentIndex,
  slideCount,
  processingSlides,
}: NotesPanelProps) {
  const completedCount = Object.keys(notes).length;

  return (
    <div className="notes-panel">
      <div className="notes-header">
        <h3>スピーカーノート</h3>
        <span className="notes-progress">
          {completedCount} / {slideCount} スライド完了
        </span>
      </div>

      <div className="notes-content">
        {processingSlides.has(currentIndex) ? (
          <div className="notes-processing">
            <div className="spinner" />
            <p>ノートを生成中...</p>
          </div>
        ) : notes[currentIndex] ? (
          <div className="note-item">
            <div className="note-text">{notes[currentIndex]}</div>
          </div>
        ) : transcripts[currentIndex] ? (
          <div className="note-item">
            <div className="note-label">文字起こし（未整理）</div>
            <div className="note-text transcript">
              {transcripts[currentIndex]}
            </div>
          </div>
        ) : (
          <div className="notes-empty">
            <p>このスライドのノートはまだありません</p>
            <p className="notes-hint">
              録音を開始してスライドを送ると、ノートが生成されます
            </p>
          </div>
        )}
      </div>

      {completedCount > 0 && (
        <div className="notes-all">
          <h4>全スライドのノート</h4>
          {Array.from({ length: slideCount }, (_, i) => (
            <div
              key={i}
              className={`note-summary ${i === currentIndex ? "current" : ""}`}
            >
              <div className="note-summary-header">スライド {i + 1}</div>
              {notes[i] ? (
                <div className="note-summary-text">{notes[i]}</div>
              ) : (
                <div className="note-summary-empty">—</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
