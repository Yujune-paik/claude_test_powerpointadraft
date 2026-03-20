import { useCallback, useState } from "react";

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".pptx")) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  return (
    <div
      className={`upload-area ${isDragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isLoading ? (
        <div className="upload-loading">
          <div className="spinner" />
          <p>スライドを読み込み中...</p>
        </div>
      ) : (
        <>
          <div className="upload-icon">📎</div>
          <p>PPTXファイルをドラッグ&ドロップ</p>
          <p className="upload-sub">または</p>
          <label className="upload-button">
            ファイルを選択
            <input
              type="file"
              accept=".pptx"
              onChange={handleFileInput}
              hidden
            />
          </label>
        </>
      )}
    </div>
  );
}
