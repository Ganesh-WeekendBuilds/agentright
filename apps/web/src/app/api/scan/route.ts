import { scoreAgent, normalizeConfig } from "@agentright/core";
/**
 * POST /api/scan
 *
 * Agent self-registration and scoring endpoint.
 * Accepts an agent config JSON body, returns a ScanResult.
 *
 * No auth required (free tier). Rate-limited by Vercel defaults.
 *
 * Usage:
 *   curl -X POST https://agentright.vercel.app/api/scan \
 *     -H "Content-Type: application/json" \
 *     -d @my-agent-config.json
 *
 * Response: ScanResult JSON with trust_score, grade, dimensions, gaps.
 * HTTP 200 = scored successfully (check trust_score for pass/fail)
 * HTTP 400 = invalid input
 * HTTP 429 = rate limited
 */

import { NextRequest, NextResponse } from "next/server";

const MAX_BODY_SIZE = 100_000; // 100KB

export async function POST(request: NextRequest) {
  try {
    // Parse body
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Content-Type must be application/json",
          docs: "/docs",
        },
        { status: 400 }
      );
    }

    const text = await request.text();
    if (text.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large. Max 100KB." },
        { status: 400 }
      );
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    // Normalize and score
    const config = normalizeConfig(raw);
    const result = scoreAgent(config);

    // Add API metadata
    const response = {
      ...result,
      api_version: "v1",
      pass: result.trust_score >= 50,
      docs: "/docs",
    };

    // Return with appropriate status
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "X-AgentRight-Score": String(result.trust_score),
        "X-AgentRight-Grade": result.grade,
        "X-AgentRight-Pass": result.trust_score >= 50 ? "true" : "false",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Scan API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
