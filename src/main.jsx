import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Image as ImageIcon,
  Pipette,
  Upload,
  Zap,
  Download,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "./styles.css";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function App() {
  const fileRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [target, setTarget] = useState("#FFFFFF");
  const [tolerance, setTolerance] = useState(32);
  const [status, setStatus] = useState("Ready to export");
  const [hasImage, setHasImage] = useState(false);

  const processImage = useCallback((img, color, tol) => {
    const source = sourceCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!source || !preview) return;

    const maxW = 1100;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    [source, preview].forEach((c) => {
      c.width = w;
      c.height = h;
    });

    const sctx = source.getContext("2d", { willReadFrequently: true });
    const pctx = preview.getContext("2d", { willReadFrequently: true });
    sctx.clearRect(0, 0, w, h);
    pctx.clearRect(0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);

    const src = sctx.getImageData(0, 0, w, h);
    const out = pctx.createImageData(w, h);
    const t = hexToRgb(color);

    // Euclidean RGB distance: sqrt((r-tr)^2 + (g-tg)^2 + (b-tb)^2)
    const threshold = tol * Math.sqrt(3 * 255 * 255);

    for (let i = 0; i < src.data.length; i += 4) {
      const dr = src.data[i] - t.r;
      const dg = src.data[i + 1] - t.g;
      const db = src.data[i + 2] - t.b;
      const distance = Math.hypot(dr, dg, db);

      out.data[i] = src.data[i];
      out.data[i + 1] = src.data[i + 1];
      out.data[i + 2] = src.data[i + 2];
      out.data[i + 3] = distance <= threshold ? 0 : src.data[i + 3];
    }
    pctx.putImageData(out, 0, 0);
    setStatus("Ready to export");
  }, []);

  const loadImage = useCallback(
    (file) => {
      if (!file?.type.startsWith("image/")) return;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setSourceUrl(url);
      setFileName(file.name);

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        // Automatically sample the top-left pixel as the initial target color.
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 1, 1);
        const px = ctx.getImageData(0, 0, 1, 1).data;
        setTarget(rgbToHex(px[0], px[1], px[2]));
        setHasImage(true);
        requestAnimationFrame(() =>
          processImage(img, rgbToHex(px[0], px[1], px[2]), tolerance),
        );
      };
      img.src = url;
    },
    [processImage, tolerance],
  );

  useEffect(() => {
    if (imageRef.current) processImage(imageRef.current, target, tolerance);
  }, [target, tolerance, processImage]);

  const onFile = (e) => loadImage(e.target.files?.[0]);

  const pickColor = async () => {
    const EyeDropper = window.EyeDropper;
    if (EyeDropper) {
      try {
        const result = await new EyeDropper().open();
        setTarget(result.sRGBHex.toUpperCase());
        return;
      } catch {}
    }
    // Fallback: open the native color picker.
    document.getElementById("color-input")?.click();
  };

  const exportPng = () => {
    if (!hasImage) return;
    const canvas = previewCanvasRef.current;
    const a = document.createElement("a");
    const base = fileName.replace(/\.[^/.]+$/, "") || "pureeraser";
    a.download = `${base}-transparent.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    setStatus("Exported successfully");
  };

  const clearAll = () => {
    setHasImage(false);
    setFileName("");
    setSourceUrl("");
    setStatus("Ready to export");
    imageRef.current = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    [sourceCanvasRef.current, previewCanvasRef.current].forEach((c) => {
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  let tolLabel = "BALANCED";
  if (tolerance <= 25) tolLabel = "STRICT";
  if (tolerance >= 70) tolLabel = "LOOSE";

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <div className="app-layout flex min-h-screen">
        <aside className="sidebar flex w-[310px] shrink-0 flex-col px-6 py-7">
          <div className="brand flex items-center gap-3">
            <div className="brand-mark grid h-10 w-10 place-items-center rounded-xl">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white">PureEraser</div>
              <div className="text-xs text-slate-400">Background remover</div>
            </div>
          </div>

          <div className="sidebar-content mt-10 space-y-8">
            <section>
              <div className="section-title">REMOVE COLOR</div>
              <p className="control-hint">Choose the color you want to make transparent.</p>
              <div className="color-control mt-3 flex items-center gap-3">
                <div
                  className="color-swatch h-11 w-11 shrink-0 rounded-lg"
                  style={{ background: target }}
                  title={target}
                />
                <button onClick={pickColor} className="action-secondary flex-1">
                  <Pipette size={16} />
                  Pick Color
                </button>
                <input
                  id="color-input"
                  type="color"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.toUpperCase())}
                  className="sr-only"
                />
              </div>
              <div className="mt-2 font-mono text-xs text-slate-500">
                {target}
              </div>
            </section>

            <section>
              <div className="section-title flex items-center justify-between">
                <span>TOLERANCE</span>
                <span className="value-pill font-mono">{tolerance}</span>
              </div>
              <p className="control-hint">Fine-tune how much of the background is removed.</p>
              <input
                aria-label="Tolerance"
                type="range"
                min="0"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="mt-4 w-full accent-blue-500"
              />
              <div className="mt-2 flex justify-between text-[10px] font-semibold tracking-widest text-slate-500">
                <span>STRICT</span>
                <span>{tolLabel}</span>
                <span>LOOSE</span>
              </div>
            </section>
          </div>

          <div className="sidebar-bottom mt-auto">
            <div className="status-card mb-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm">
              <ShieldCheck size={16} className="text-emerald-400" />
              {status}
            </div>
            <button
              onClick={exportPng}
              disabled={!hasImage}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-35">
              <span className="inline-flex items-center justify-center gap-2">
                <Download size={17} />
                Export PNG
              </span>
            </button>
            <button
              onClick={clearAll}
              className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-200">
              <span className="inline-flex items-center gap-2">
                <RotateCcw size={14} /> Clear All
              </span>
            </button>
          </div>
        </aside>

        <main className="main-shell flex min-w-0 flex-1 flex-col p-6">
          <div className="topbar mb-5 flex items-center justify-between">
            <div>
              <div className="eyebrow"><Sparkles size={13} /> QUICK EDITOR</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Make the background disappear.</h1>
              <p className="mt-1 text-sm text-slate-400">A fast, private way to remove solid-color backgrounds.</p>
            </div>
            <label className="action-primary cursor-pointer" title="Upload an image">
              <Upload size={16} />
              Upload Image
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="workspace-grid grid min-h-0 flex-1 grid-cols-2 gap-5">
            <Panel
              title="SOURCE IMAGE"
              icon={<ImageIcon size={16} />}
              subtitle={fileName || "Original image"}>
              <div className="canvas-wrap source-canvas">
                {hasImage ? (
                  <img
                    src={sourceUrl}
                    alt="Source"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Dropzone onFile={loadImage} />
                )}
              </div>
            </Panel>

            <Panel
              title="PREVIEW RESULT"
              icon={<Check size={16} />}
              subtitle={
                hasImage ? "Transparent background" : "Processed output"
              }>
              <div className="canvas-wrap checkerboard preview-canvas">
                {hasImage ? (
                  <canvas
                    ref={previewCanvasRef}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="empty-state text-center">
                    <div className="empty-icon mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
                      <ImageIcon size={20} />
                    </div>
                    <p className="text-sm font-medium text-slate-300">Your transparent preview will appear here.</p>
                    <p className="mt-1 text-xs text-slate-500">Upload an image to get started.</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
          <canvas ref={sourceCanvasRef} className="hidden" />
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Eng. Walid Rashad</span>
            <span className="footer-dot" />
            <span>Private by design</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Panel({ title, icon, subtitle, children }) {
  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="panel-heading flex items-center justify-between px-4 py-3">
        <div className="panel-label flex items-center gap-2 text-xs font-bold tracking-[0.16em]">
          {icon}
          <span>{title}</span>
        </div>
        <span className="panel-subtitle max-w-[45%] truncate text-xs">
          {subtitle}
        </span>
      </div>
      <div className="panel-body min-h-0 flex-1 p-4">{children}</div>
    </section>
  );
}

function Dropzone({ onFile }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex h-full min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition ${drag ? "border-blue-400 bg-blue-400/5" : "border-white/10 bg-white/[0.015] hover:border-white/20"}`}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") ref.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onFile(e.dataTransfer.files?.[0]);
      }}>
      <div className="grid h-14 w-14 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
        <Upload size={23} />
      </div>
      <p className="mt-4 font-medium">Drop an image here</p>
      <p className="mt-1 text-sm text-slate-600">or click to browse</p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
