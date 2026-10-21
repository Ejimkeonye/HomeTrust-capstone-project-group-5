import { useRef, useState, useEffect } from "react";
import { RotateCcw, Check } from "lucide-react";

function getImageSource(signature) {
  if (typeof signature === "string") {
    return signature.startsWith("data:image/") ||
      /^https?:\/\//i.test(signature)
      ? signature
      : null;
  }
  if (!signature || typeof signature !== "object") return null;
  const candidate =
    signature.url ||
    signature.imageUrl ||
    signature.signatureUrl ||
    signature.signedImageUrl ||
    signature.dataUrl;
  return typeof candidate === "string" &&
    (candidate.startsWith("data:image/") || /^https?:\/\//i.test(candidate))
    ? candidate
    : null;
}

export default function SignatureCanvas({
  label,
  onSave,
  savedSignature,
  disabled,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const imageSource = getImageSource(savedSignature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    if (e.cancelable) e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    if (e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (canvas)
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSave(null);
  };

  const handleConfirm = () => {
    if (!hasDrawn || disabled) return;
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-700">{label}</label>
        {imageSource && (
          <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Ready to submit
          </span>
        )}
      </div>
      {imageSource ? (
        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center relative group">
          <img
            src={imageSource}
            alt={`${label} signature preview`}
            className="h-20 mx-auto object-contain"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors cursor-pointer font-medium"
            >
              Clear & Retake
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={320}
            height={100}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`w-full h-24 bg-white border border-slate-300 rounded-xl touch-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair"}`}
          />
          {!disabled && (
            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
              <button
                type="button"
                disabled={!hasDrawn}
                onClick={handleConfirm}
                className="bg-[#4A1E6D] hover:bg-purple-950 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Use Signature
              </button>
            </div>
          )}
        </div>
      )}
      {imageSource && (
        <p className="text-[11px] text-slate-500">
          This is a local preview. It is not saved until you submit it and the
          server confirms success.
        </p>
      )}
    </div>
  );
}
