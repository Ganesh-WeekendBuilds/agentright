/**
 * GET /api/badge?score=94&grade=A
 *
 * Returns an SVG trust badge that agents/repos can embed.
 * Use in README.md: ![AgentRight](https://agentright.vercel.app/api/badge?score=94&grade=A)
 *
 * Or after scanning via API, use the returned score/grade to build the URL.
 */

import { NextRequest, NextResponse } from "next/server";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const score = searchParams.get("score") || "?";
  const gradeParam = searchParams.get("grade") || "?";
  const gradeUpper = gradeParam.toUpperCase();
  const color = GRADE_COLORS[gradeUpper] || "#6b7280";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="152" height="20" viewBox="0 0 152 20">
  <defs>
    <linearGradient id="bg" x2="0" y2="100%">
      <stop offset="0" stop-color="#0a0e17" stop-opacity=".9"/>
      <stop offset="1" stop-color="#0a0e17"/>
    </linearGradient>
  </defs>
  <clipPath id="r"><rect width="152" height="20" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="88" height="20" fill="url(#bg)"/>
    <rect x="88" width="64" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="44" y="14" fill="#94a3b8">AgentRight</text>
    <text x="120" y="14" font-weight="bold">${score} · ${gradeUpper}</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
