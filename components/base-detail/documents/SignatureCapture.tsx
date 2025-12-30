"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Check, PenTool, Type } from "lucide-react";

type SignatureCaptureProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageData: string) => void;
};

type SignatureMode = "draw" | "type";

export const SignatureCapture = ({ isOpen, onClose, onSave }: SignatureCaptureProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<SignatureMode>("draw");
  const [typedSignature, setTypedSignature] = useState("");

  // Initialize canvas with white background when modal opens
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    // Set explicit canvas dimensions
    // Use fixed dimensions for consistent drawing
    const width = 600;
    const height = 200;
    
    // Set internal canvas size (actual drawing resolution)
    canvas.width = width;
    canvas.height = height;

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Set drawing styles
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // Initialize canvas when modal opens (only for draw mode)
  useEffect(() => {
    if (isOpen && canvasRef.current && mode === "draw") {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(initializeCanvas, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, initializeCanvas]);

  // Load cursive font when component mounts
  useEffect(() => {
    // Load Google Fonts Dancing Script
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    
    return () => {
      // Only remove if we added it (check if it exists)
      const existingLink = document.querySelector(`link[href="${link.href}"]`);
      if (existingLink && existingLink === link) {
        document.head.removeChild(link);
      }
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates relative to canvas internal size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates relative to canvas internal size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  }, [isDrawing]);

  const handleClear = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Clear and refill with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const handleSave = async () => {
    if (mode === "type") {
      // Generate signature image from typed text
      if (!typedSignature.trim()) {
        return;
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;
      
      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load cursive font
      try {
        const font = new FontFace(
          "Dancing Script",
          "url(https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup8.woff2)"
        );
        await font.load();
        document.fonts.add(font);
      } catch (err) {
        console.warn("Failed to load Dancing Script font, using fallback", err);
      }
      
      // Set font with cursive fallback
      ctx.font = "48px 'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Measure text to ensure it fits
      const text = typedSignature.trim();
      const metrics = ctx.measureText(text);
      let fontSize = 48;
      
      // Adjust font size if text is too wide
      if (metrics.width > canvas.width - 40) {
        fontSize = Math.floor((canvas.width - 40) / metrics.width * fontSize);
        ctx.font = `${fontSize}px 'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive`;
      }
      
      // Draw signature text centered
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      
      const imageData = canvas.toDataURL("image/png");
      onSave(imageData);
      setTypedSignature("");
    } else {
      // Draw mode - save canvas
      if (!canvasRef.current) return;
      const imageData = canvasRef.current.toDataURL("image/png");
      onSave(imageData);
      handleClear();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Signature</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Mode Selection */}
        <div className="flex items-center gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode("draw")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "draw"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <PenTool className="w-4 h-4" />
            Draw
          </button>
          <button
            onClick={() => setMode("type")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "type"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Type className="w-4 h-4" />
            Type
          </button>
        </div>

        {/* Draw Mode */}
        {mode === "draw" && (
          <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-[200px] cursor-crosshair touch-none block"
              style={{ touchAction: "none" }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => {
                e.preventDefault();
                if (!canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const touch = e.touches[0];
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;

                ctx.beginPath();
                ctx.moveTo(x, y);
                setIsDrawing(true);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!isDrawing || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const touch = e.touches[0];
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;

                ctx.lineTo(x, y);
                ctx.stroke();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                setIsDrawing(false);
              }}
            />
          </div>
        )}

        {/* Type Mode */}
        {mode === "type" && (
          <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
            <div className="h-[200px] flex items-center justify-center bg-gray-50">
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Type your signature here"
                className="w-full px-4 py-2 text-center text-4xl font-signature bg-transparent border-0 outline-none focus:outline-none"
                style={{
                  fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
                  color: "#000000"
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => {
              if (mode === "draw") {
                handleClear();
              } else {
                setTypedSignature("");
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={mode === "type" && !typedSignature.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
};

