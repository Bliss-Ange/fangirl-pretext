"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { prepareWithSegments, layoutNextLine, type LayoutCursor } from "@chenglou/pretext";
import { SAMPLE_TEXT, PAGE_CONFIG } from "./content";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_IMAGE = PAGE_CONFIG.defaultImage;

const CANVAS_W    = 836;
const CANVAS_H    = 720;
const FONT_SIZE   = 15;
const LINE_HEIGHT = 26;
const FONT        = `${FONT_SIZE}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const IMG_MAX     = 260;
const PADDING     = 40;
const COL_GAP     = 40;
const COL_W       = (CANVAS_W - PADDING * 2 - COL_GAP) / 2;
const COL1_X      = PADDING;
const COL2_X      = PADDING + COL_W + COL_GAP;
const TEXT_GAP    = 12;

// ─── Palette ─────────────────────────────────────────────────────────────────
const BG       = "#0a0a0a";   // near-black canvas background
const TEXT_CLR = "#cccccc";   // light grey body text
const DIVIDER  = "#1a1a1a";   // subtle divider
const ACCENT   = "#ffffff";   // pure white accent

// ─── Types ───────────────────────────────────────────────────────────────────
type VisibleBox = { dx: number; dy: number; w: number; h: number };
type ImgSize    = { w: number; h: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function computeImgSize(img: HTMLImageElement): ImgSize {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return { w: IMG_MAX, h: IMG_MAX };
  const scale = Math.min(IMG_MAX / nw, IMG_MAX / nh, 1);
  return { w: Math.round(nw * scale), h: Math.round(nh * scale) };
}

function computeVisibleBox(img: HTMLImageElement, size: ImgSize): VisibleBox {
  try {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = sw; off.height = sh;
    const ctx = off.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, sw, sh);
    let minX = sw, maxX = 0, minY = sh, maxY = 0;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return { dx: 0, dy: 0, w: size.w, h: size.h };
    return {
      dx: minX * size.w / sw, dy: minY * size.h / sh,
      w: (maxX - minX) * size.w / sw, h: (maxY - minY) * size.h / sh,
    };
  } catch { return { dx: 0, dy: 0, w: size.w, h: size.h }; }
}

function colSegment(colX: number, colW: number, rowY: number, imgX: number, imgY: number, vb: VisibleBox) {
  const excL = imgX + vb.dx - TEXT_GAP, excR = imgX + vb.dx + vb.w + TEXT_GAP;
  const excT = imgY + vb.dy - TEXT_GAP, excB = imgY + vb.dy + vb.h + TEXT_GAP;
  const midY = rowY + LINE_HEIGHT / 2, colR = colX + colW;
  if (midY < excT || midY > excB) return { x: colX, w: colW };
  if (excR <= colX || excL >= colR) return { x: colX, w: colW };
  if (excL <= colX && excR >= colR) return null;
  if (excL > colX && excR >= colR)  { const w = excL - colX; return w > 8 ? { x: colX, w } : null; }
  if (excL <= colX && excR < colR)  { const x = excR, w = colR - x; return w > 8 ? { x, w } : null; }
  const lw = excL - colX, rx = excR, rw = colR - rx;
  if (lw >= rw && lw > 8) return { x: colX, w: lw };
  return rw > 8 ? { x: rx, w: rw } : null;
}

function isTextDone(cursor: LayoutCursor, segments: string[]) {
  if (!segments.length) return true;
  const last = segments[segments.length - 1] ?? "";
  return cursor.segmentIndex >= segments.length - 1 && cursor.graphemeIndex >= last.length;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  const [imgSrc, setImgSrc]         = useState(DEFAULT_IMAGE);
  const [imgPos, setImgPos]         = useState({ x: CANVAS_W / 2 - IMG_MAX / 2, y: CANVAS_H / 2 - IMG_MAX / 2 });
  const [imgSize, setImgSize]       = useState<ImgSize>({ w: IMG_MAX, h: IMG_MAX });
  const [visibleBox, setVisibleBox] = useState<VisibleBox>({ dx: 0, dy: 0, w: IMG_MAX, h: IMG_MAX });
  const dragging     = useRef(false);
  const dragOffset   = useRef({ x: 0, y: 0 });
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imgObjRef    = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draw = useCallback((vb: VisibleBox = visibleBox, sz: ImgSize = imgSize) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Dark background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Column divider — single subtle line
    const divX = PADDING + COL_W + COL_GAP / 2;
    ctx.save();
    ctx.strokeStyle = DIVIDER; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(divX, PADDING); ctx.lineTo(divX, CANVAS_H - PADDING); ctx.stroke();
    ctx.restore();

    // Article label — centered
    ctx.save();
    ctx.font = `600 10px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.letterSpacing = "2px";
    ctx.fillText(PAGE_CONFIG.canvasLabel, CANVAS_W / 2, 14);
    ctx.restore();

    // Body text
    ctx.font = FONT; ctx.fillStyle = TEXT_CLR; ctx.textBaseline = "top";
    const prepared = prepareWithSegments(SAMPLE_TEXT, FONT);
    const segments: string[] = (prepared as any).segments ?? [];
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

    for (let y = PADDING; y < CANVAS_H - LINE_HEIGHT; y += LINE_HEIGHT) {
      if (isTextDone(cursor, segments)) break;
      const seg = colSegment(COL1_X, COL_W, y, imgPos.x, imgPos.y, vb);
      if (!seg || seg.w < 16) continue;
      const line = layoutNextLine(prepared, cursor, seg.w);
      if (!line) break;
      ctx.fillText(line.text, seg.x, y);
      cursor = line.end;
    }
    for (let y = PADDING; y < CANVAS_H - LINE_HEIGHT; y += LINE_HEIGHT) {
      if (isTextDone(cursor, segments)) break;
      const seg = colSegment(COL2_X, COL_W, y, imgPos.x, imgPos.y, vb);
      if (!seg || seg.w < 16) continue;
      const line = layoutNextLine(prepared, cursor, seg.w);
      if (!line) break;
      ctx.fillText(line.text, seg.x, y);
      cursor = line.end;
    }

    // Image — draw cleanly, no outlines
    const img = imgObjRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, imgPos.x, imgPos.y, sz.w, sz.h);
    }
  }, [imgPos, visibleBox, imgSize]);

  useEffect(() => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      imgObjRef.current = img;
      const sz = computeImgSize(img);
      const vb = computeVisibleBox(img, sz);
      setImgSize(sz); setVisibleBox(vb);
      setImgPos({ x: CANVAS_W / 2 - sz.w / 2, y: CANVAS_H / 2 - sz.h / 2 });
      draw(vb, sz);
    };
    img.src = imgSrc;
  }, [imgSrc]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top)  * (CANVAS_H / rect.height);
    if (mx >= imgPos.x && mx <= imgPos.x + imgSize.w && my >= imgPos.y && my <= imgPos.y + imgSize.h) {
      dragging.current = true;
      dragOffset.current = { x: mx - imgPos.x, y: my - imgPos.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top)  * (CANVAS_H / rect.height);
    setImgPos({
      x: Math.max(0, Math.min(mx - dragOffset.current.x, CANVAS_W - imgSize.w)),
      y: Math.max(0, Math.min(my - dragOffset.current.y, CANVAS_H - imgSize.h)),
    });
  };

  const handleMouseUp = () => { dragging.current = false; };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => { if (evt.target?.result) setImgSrc(evt.target.result as string); };
    reader.readAsDataURL(file);
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>

      {/* Nav bar */}
      <Box component="nav" sx={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        px: 6, py: 3,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <Typography sx={{
          fontWeight: 400, fontSize: "0.8rem", letterSpacing: "0.28em",
          textTransform: "uppercase", color: ACCENT,
        }}>
          {PAGE_CONFIG.navBrand}
        </Typography>
        <Box sx={{ display: "flex", gap: 5 }}>
          {PAGE_CONFIG.navLinks.map(item => (
            <Typography key={item} sx={{
              fontSize: "0.65rem", letterSpacing: "0.18em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              "&:hover": { color: "#fff" },
              transition: "color 0.25s",
            }}>
              {item}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Hero strip */}
      <Box sx={{
        px: 6, pt: 12, pb: 10,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center",
      }}>
        <Typography sx={{
          fontSize: "0.6rem", letterSpacing: "0.3em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
          mb: 3,
        }}>
          {PAGE_CONFIG.heroLabel}
        </Typography>
        <Typography sx={{
          fontSize: { xs: "3.5rem", md: "6rem" },
          fontWeight: 300,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          lineHeight: 1,
          color: ACCENT,
        }}>
          {PAGE_CONFIG.heroTitle}
        </Typography>
        <Box sx={{ width: 40, height: "1px", background: "rgba(255,255,255,0.2)", my: 3 }} />
        <Typography sx={{
          fontSize: "0.65rem", color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.2em",
        }}>
          {PAGE_CONFIG.heroSubtitle}
        </Typography>
      </Box>

      {/* Main content */}
      <Box sx={{ maxWidth: 960, mx: "auto", px: 5, pt: 5, pb: 8 }}>

        {/* Upload button */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
          <Button
            variant="outlined"
            component="label"
            size="small"
            sx={{
              color: ACCENT,
              borderColor: "rgba(255,255,255,0.25)",
              borderRadius: 0,
              fontFamily: "inherit",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              px: 3, py: 1,
              "&:hover": { borderColor: ACCENT, background: "rgba(255,255,255,0.05)" },
            }}
          >
            Upload Image
            <input type="file" accept="image/png, image/jpeg" hidden ref={fileInputRef} onChange={handleImageUpload} />
          </Button>
        </Box>

        {/* Canvas */}
        <Paper elevation={0} sx={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 0,
          overflow: "hidden",
        }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ display: "block", width: "100%", height: "auto", cursor: "default" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </Paper>

        <Typography sx={{
          mt: 1.5, fontSize: "0.68rem", letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.2)", textAlign: "right",
          textTransform: "uppercase",
        }}>
          {PAGE_CONFIG.canvasHint}
        </Typography>
      </Box>

      {/* Footer */}
      <Box sx={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        px: 6, py: 4,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Typography sx={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
          {PAGE_CONFIG.footerLeft}
        </Typography>
        <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
            {PAGE_CONFIG.footerRight}
          </Typography>
          <Typography
            component="a"
            href={PAGE_CONFIG.footerCreditUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: "0.65rem", letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
              textDecoration: "none",
              "&:hover": { color: "#fff", textDecoration: "underline" },
              transition: "color 0.2s",
            }}
          >
            {PAGE_CONFIG.footerCreditText}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
