import type { CropGroup } from "@/lib/engine/types";

/** ภาพลายเส้นประจำกลุ่มพืช (วาดเอง ใช้สีคราม/ขมิ้น) */
export function Glyph({ crop, size = 52 }: { crop: CropGroup; size?: number }) {
  const s = { fill: "none", stroke: "#1c2a4d", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const accent = { ...s, stroke: "#d9961a" };
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="25" fill="#e4e9f3" />
      {crop === "rice" && (
        <g>
          <path {...s} d="M26 44V16" />
          <path {...accent} d="M26 18c-4 1-6 4-6 7M26 23c-4 1-6 4-6 7M26 28c-4 1-6 4-6 7M26 20c4 1 6 4 6 7M26 25c4 1 6 4 6 7" />
          <path {...s} d="M12 44h28" />
          <path {...s} strokeDasharray="2 3" d="M10 40h32" />
        </g>
      )}
      {crop === "field" && (
        <g>
          <path {...s} d="M20 44V12M32 44V16" />
          <path {...s} d="M17 22h6M17 31h6M29 25h6M29 34h6" />
          <path {...accent} d="M20 12c-5-2-8 0-10 3M32 16c5-3 8-1 10 2" />
          <path {...s} d="M12 44h28" />
        </g>
      )}
      {crop === "vegetable" && (
        <g>
          <path {...s} d="M26 42c-9 0-13-7-13-12 6 0 10 3 13 8 3-5 7-8 13-8 0 5-4 12-13 12z" />
          <path {...accent} d="M26 38V18M26 18c-3-4-1-8 0-9 1 1 3 5 0 9z" />
        </g>
      )}
      {crop === "fruit" && (
        <g>
          <path {...s} d="M26 44V28M26 34l-6-5M26 31l5-4" />
          <path {...s} d="M26 30c-10 0-14-5-14-10 0-6 6-10 14-10s14 4 14 10c0 5-4 10-14 10z" />
          <circle cx="20" cy="20" r="2.4" fill="#d9961a" />
          <circle cx="31" cy="17" r="2.4" fill="#d9961a" />
          <circle cx="29" cy="25" r="2.4" fill="#d9961a" />
        </g>
      )}
      {crop === "forest" && (
        <g>
          <path {...s} d="M18 44V34M34 44V30" />
          <path {...s} d="M18 10l-8 14h4l-5 10h18l-5-10h4z" />
          <path {...accent} d="M34 8l-7 12h3l-5 10h18l-5-10h3z" />
          <path {...s} d="M8 44h36" />
        </g>
      )}
    </svg>
  );
}
