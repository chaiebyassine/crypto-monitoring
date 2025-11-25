import { useEffect, useRef, useState } from "react";
import type { OhlcPoint } from "../lib/api";

type Props = {
  data: OhlcPoint[];
  height?: number;
};

export default function CandlestickChart({ data, height = 480 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: height });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    // initialize to actual container size
    setSize({ w: el.clientWidth || 800, h: el.clientHeight || height });
    return () => ro.disconnect();
  }, [height]);

  if (!data || data.length === 0) return <div style={{ color: "#a0aec0" }}>No OHLC data</div>;

  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);

  const padding = 12;
  const volAreaH = Math.floor(size.h * 0.18); // small volume area
  const mainH = size.h - padding * 2 - volAreaH - 8; // main chart height
  const chartW = Math.max(120, size.w - padding * 2);

  const xFor = (i: number) => padding + (i + 0.5) * (chartW / data.length);
  const yFor = (v: number) => padding + ((max - v) / (max - min || 1)) * mainH;

  // volumes
  const volumes = data.map((d) => d.volume ?? 0);
  const maxVol = Math.max(...volumes, 0);
  const volumeYFor = (v: number) => padding + mainH + 8 + ((maxVol - v) / (maxVol || 1)) * volAreaH;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMove = (evt: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    setMousePos({ x: evt.clientX, y: evt.clientY });
    // determine nearest index
    const rel = Math.max(0, Math.min(chartW, x - padding));
    const idx = Math.floor((rel / chartW) * data.length);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const candleWidth = Math.max(6, Math.min(32, (chartW / data.length) * 0.7));

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg ref={svgRef} width={size.w} height={size.h} onMouseMove={handleMove} onMouseLeave={() => { setHoverIdx(null); setMousePos(null); }}>
        {/* background grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding + t * mainH;
          return <line key={t} x1={padding} x2={padding + chartW} y1={y} y2={y} stroke="#23303a" strokeWidth={1} />;
        })}

        {/* price axis left (small ticks) */}
        {data.map((d, i) => {
          const x = xFor(i);
          const highY = yFor(d.high);
          const lowY = yFor(d.low);
          const openY = yFor(d.open);
          const closeY = yFor(d.close);
          const bodyTop = Math.min(openY, closeY);
          const bodyBottom = Math.max(openY, closeY);
          const bodyHeight = Math.max(2, bodyBottom - bodyTop);
          const xLeft = x - candleWidth / 2;
          const color = d.close >= d.open ? "#00c789" : "#ff6b6b";

          return (
            <g key={d.t}>
              {/* wick */}
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1} style={{ transition: "stroke 200ms" }} />
              {/* body */}
              <rect x={xLeft} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx={2} style={{ transition: "y 180ms, height 180ms, fill 150ms" }} />
            </g>
          );
        })}

        {/* volume bars */}
        {volumes.some((v) => v > 0) && data.map((d, i) => {
          const vol = d.volume ?? 0;
          const x = xFor(i);
          const xLeft = x - candleWidth / 2;
          const volTop = volumeYFor(vol);
          const volHeight = Math.max(1, padding + mainH + volAreaH - volTop + 2);
          const color = d.close >= d.open ? "rgba(0,199,137,0.9)" : "rgba(255,107,107,0.9)";
          return <rect key={"v" + d.t} x={xLeft} y={volTop} width={candleWidth} height={volHeight} fill={color} opacity={0.9} />;
        })}

        {/* crosshair */}
        {hoverIdx !== null && mousePos && (() => {
          const i = hoverIdx;
          const x = xFor(i);
          const d = data[i];
          const y = yFor(d.close);
          return (
            <g>
              <line x1={x} x2={x} y1={padding} y2={padding + mainH} stroke="#5b7286" strokeWidth={1} strokeDasharray="4 4" />
              <line x1={padding} x2={padding + chartW} y1={y} y2={y} stroke="#5b7286" strokeWidth={1} strokeDasharray="4 4" />
            </g>
          );
        })()}
      </svg>

      {/* tooltip */}
      {hoverIdx !== null && data[hoverIdx] && mousePos && (
        <div style={{ position: "absolute", pointerEvents: "none", left: mousePos.x + 12, top: mousePos.y - 36, background: "rgba(8,12,18,0.95)", color: "#fff", padding: 10, borderRadius: 8, border: "1px solid #23303a", fontSize: 12, minWidth: 140 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{new Date(data[hoverIdx].t).toLocaleString()}</div>
          <div>O: {data[hoverIdx].open}</div>
          <div>H: {data[hoverIdx].high}</div>
          <div>L: {data[hoverIdx].low}</div>
          <div>C: {data[hoverIdx].close}</div>
          {data[hoverIdx].volume != null && <div style={{ marginTop: 6, color: "#a0aec0" }}>Vol: {Number(data[hoverIdx].volume).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}
