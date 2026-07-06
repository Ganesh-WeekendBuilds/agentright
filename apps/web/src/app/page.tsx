"use client";

import { parseConfigString, scoreAgent, ScanResult, AgentIdentity, FleetAgent, FleetSummary } from "@agentright/core";


import { useState, useEffect, useRef, useCallback } from "react";
import { SAMPLE_CONFIGS } from "@/lib/samples";
import { generateReport } from "@/lib/report";
import {
  getFleet,
  addToFleet,
  removeFromFleet,
  getFleetSummary,
  getAgentStatus,
  clearFleet,
} from "@/lib/fleet";
import {
  decodeConfigFromHash,
  buildShareableUrl,
} from "@/lib/share";

// ═══════════════════════════════════════════════════════
// DESIGN TOKENS (inline for component styles)
// ═══════════════════════════════════════════════════════

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};
const SEV_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};
const SEV_BG: Record<string, string> = {
  critical: "rgba(239,68,68,0.08)",
  high: "rgba(249,115,22,0.06)",
  medium: "rgba(234,179,8,0.05)",
  low: "rgba(107,114,128,0.04)",
};
const DIM_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#6366f1"];
const STATUS_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
};

type AppView = "scan" | "results" | "fleet";

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

export default function AgentRightApp() {
  const [view, setView] = useState<AppView>("scan");
  const [configText, setConfigText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Partial<AgentIdentity> | null>(null);
  const [error, setError] = useState("");
  const [fleet, setFleet] = useState<FleetAgent[]>([]);
  const [fleetMessage, setFleetMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load fleet on mount and check for shared config in URL hash
  useEffect(() => {
    setFleet(getFleet());

    if (typeof window !== "undefined" && window.location.hash) {
      const config = decodeConfigFromHash(window.location.hash);
      if (config) {
        const text = JSON.stringify(config, null, 2);
        setConfigText(text);
        runScan(text);
      }
    }
  }, []);

  const runScan = useCallback((text: string) => {
    setError("");
    try {
      const { config } = parseConfigString(text);
      const res = scoreAgent(config);
      setResult(res);
      setCurrentConfig(config);
      setView("results");
      setShareUrl(buildShareableUrl(config));
    } catch (e: any) {
      setError(e.message || "Failed to parse config.");
    }
  }, []);

  const loadSample = (key: string) => {
    const sample = SAMPLE_CONFIGS[key];
    if (!sample) return;
    const json = JSON.stringify(sample.config, null, 2);
    setConfigText(json);
    runScan(json);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setConfigText(text);
      runScan(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAddToFleet = () => {
    if (!currentConfig || !result) return;
    const { success, message, fleet: updated } = addToFleet(
      currentConfig,
      result
    );
    setFleetMessage(message);
    setFleet(updated);
    setTimeout(() => setFleetMessage(""), 3000);
  };

  const handleRemoveFromFleet = (agentId: string) => {
    const updated = removeFromFleet(agentId);
    setFleet(updated);
  };

  const handleClearFleet = () => {
    clearFleet();
    setFleet([]);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadReport = async () => {
    if (!result) return;
    setReportLoading(true);
    try {
      const blob = await generateReport(result);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentright-report-${result.agent_id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setReportLoading(false);
    }
  };

  const handleViewFleetAgent = (agent: FleetAgent) => {
    setResult(agent.result);
    setCurrentConfig(agent.config);
    setConfigText(JSON.stringify(agent.config, null, 2));
    setShareUrl(buildShareableUrl(agent.config));
    setView("results");
  };

  const summary = getFleetSummary(fleet);

  const criticalCount = result
    ? result.gaps.filter((g) => g.severity === "critical").length
    : 0;
  const highCount = result
    ? result.gaps.filter((g) => g.severity === "high").length
    : 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px", minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => { setView("scan"); setResult(null); setError(""); }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            AT
          </div>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              AgentRight
            </h1>
            <p
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
                marginTop: 1,
              }}
            >
              OPEN-SOURCE GOVERNANCE FOR AI AGENTS
            </p>
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: "flex", gap: 4 }}>
          {(["scan", "fleet"] as AppView[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid",
                borderColor:
                  view === tab || (view === "results" && tab === "scan")
                    ? "var(--border-focus)"
                    : "var(--border-subtle)",
                background:
                  view === tab || (view === "results" && tab === "scan")
                    ? "rgba(6,182,212,0.08)"
                    : "transparent",
                color:
                  view === tab || (view === "results" && tab === "scan")
                    ? "var(--cyan)"
                    : "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                transition: "all 0.2s",
                textTransform: "capitalize",
              }}
            >
              {tab === "scan" ? "Scan" : `Fleet (${fleet.length})`}
            </button>
          ))}
          <a
            href="/docs"
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              transition: "all 0.2s",
              textDecoration: "none",
            }}
          >
            API
          </a>
        </nav>
      </header>

      {/* ── SCAN VIEW (Phase 2) ── */}
      {view === "scan" && (
        <div className="fade-in">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 300,
                color: "var(--text-primary)",
                margin: "0 0 6px",
                letterSpacing: "-0.02em",
                fontFamily: "var(--font-sans)",
              }}
            >
              Scan your agent config
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Paste JSON/YAML or upload a file. Everything runs in your browser.
            </p>
          </div>

          {/* Samples */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 14,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                alignSelf: "center",
                marginRight: 2,
              }}
            >
              SAMPLES:
            </span>
            {Object.entries(SAMPLE_CONFIGS).map(([key, sample]) => (
              <button
                key={key}
                onClick={() => loadSample(key)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = "rgba(6,182,212,0.3)";
                  (e.target as HTMLElement).style.background = "rgba(6,182,212,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--border-subtle)";
                  (e.target as HTMLElement).style.background = "var(--bg-elevated)";
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              background: "var(--bg-elevated)",
              marginBottom: 14,
              position: "relative",
            }}
          >
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder={`{\n  "agent_id": "...",\n  "agent_type": "analytical",\n  "model_provider": "anthropic",\n  "model_version": "claude-sonnet-4-20250514",\n  ...\n}\n\nOr paste YAML. Or drag-drop a file.`}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 260,
                padding: "14px 18px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: 12,
                lineHeight: "20px",
                fontFamily: "var(--font-mono)",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => runScan(configText)}
              disabled={!configText.trim()}
              style={{
                padding: "9px 24px",
                borderRadius: 7,
                border: "none",
                background: configText.trim()
                  ? "linear-gradient(135deg,#06b6d4,#8b5cf6)"
                  : "rgba(255,255,255,0.05)",
                color: configText.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: 13,
                fontWeight: 600,
                cursor: configText.trim() ? "pointer" : "not-allowed",
                fontFamily: "var(--font-mono)",
                transition: "all 0.3s",
              }}
            >
              ▶ Scan
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "9px 18px",
                borderRadius: 7,
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.yaml,.yml"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* Dimension overview */}
          <div
            style={{
              marginTop: 36,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["Identity", "16-field completeness", "20%"],
              ["Permissions", "Least-privilege hygiene", "20%"],
              ["Behavioral", "Bounds and constraints", "20%"],
              ["Delegation", "Chain integrity", "15%"],
              ["Configuration", "Hash and versioning", "10%"],
              ["Data Sovereignty", "Residency, routing, lock-in", "15%"],
            ].map(([name, desc, wt], i) => (
              <div
                key={name}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: DIM_COLORS[i],
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-dim)",
                      marginLeft: "auto",
                    }}
                  >
                    {wt}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULTS VIEW (Phase 2 + Phase 3 Reports) ── */}
      {view === "results" && result && (
        <div className="fade-in">
          {/* Top: Score + Meta + Dimension bars */}
          <div
            style={{
              padding: "24px",
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(6,182,212,0.03), rgba(139,92,246,0.03))",
              border: "1px solid var(--border-subtle)",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 24,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              {/* Score ring */}
              <ScoreRing score={result.trust_score} grade={result.grade} />

              <div style={{ flex: 1, minWidth: 250 }}>
                {/* Meta chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 5,
                    marginBottom: 10,
                  }}
                >
                  {[
                    [
                      "ID",
                      result.agent_id === "unknown"
                        ? "not set"
                        : result.agent_id.slice(0, 8) + "...",
                    ],
                    ["Type", result.agent_type],
                    ["Risk", result.risk_tier.replace(/_/g, " ")],
                    [
                      "Fields",
                      `${result.field_count.present}/${result.field_count.total}`,
                    ],
                  ].map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>{k}</span>{" "}
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </span>
                  ))}
                </div>

                {/* Summary */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  {criticalCount > 0 && (
                    <span style={{ color: SEV_COLORS.critical, fontWeight: 600 }}>
                      {criticalCount} critical
                    </span>
                  )}
                  {criticalCount > 0 && highCount > 0 && " · "}
                  {highCount > 0 && (
                    <span style={{ color: SEV_COLORS.high, fontWeight: 600 }}>
                      {highCount} high
                    </span>
                  )}
                  {(criticalCount > 0 || highCount > 0) && " severity gaps. "}
                  {criticalCount === 0 && highCount === 0 && (
                    <span style={{ color: GRADE_COLORS.A }}>
                      No critical or high gaps.{" "}
                    </span>
                  )}
                </div>

                {/* Dimension bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {result.dimensions.map((d, i) => (
                    <div
                      key={d.name}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          width: 85,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        {d.name.split(" ")[0]}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.05)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${d.score}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: DIM_COLORS[i],
                            transition: "width 0.8s ease-out",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: DIM_COLORS[i],
                          fontWeight: 600,
                          width: 26,
                          textAlign: "right",
                        }}
                      >
                        {d.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--border-subtle)",
                flexWrap: "wrap",
              }}
            >
              <ActionButton
                onClick={handleDownloadReport}
                disabled={reportLoading}
                label={reportLoading ? "Generating..." : "Download PDF Report"}
              />
              <ActionButton onClick={handleAddToFleet} label="Add to Fleet" />
              <ActionButton onClick={handleCopyUrl} label={copied ? "Copied!" : "Share URL"} />
              <ActionButton
                onClick={() => {
                  setView("scan");
                  setResult(null);
                  setError("");
                }}
                label="New Scan"
              />
            </div>

            {fleetMessage && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--cyan)",
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: "rgba(6,182,212,0.08)",
                  display: "inline-block",
                }}
              >
                {fleetMessage}
              </div>
            )}
          </div>

          {/* Gaps */}
          <Section title="Gaps & Remediations" count={result.gaps.length}>
            {result.gaps.length === 0 ? (
              <EmptyState text="No gaps detected. Configuration is well-formed." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {result.gaps.map((g, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 7,
                      background: SEV_BG[g.severity],
                      borderLeft: `3px solid ${SEV_COLORS[g.severity]}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <SeverityBadge severity={g.severity} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.4 }}>
                          <code
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              background: "rgba(255,255,255,0.05)",
                              padding: "1px 4px",
                              borderRadius: 3,
                              marginRight: 5,
                            }}
                          >
                            {g.field}
                          </code>
                          {g.message}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          → {g.remediation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Dimension details */}
          <Section title="Dimension Breakdown">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {result.dimensions.map((d, i) => (
                <div
                  key={d.name}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: `1px solid ${DIM_COLORS[i]}22`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: DIM_COLORS[i] }}>
                      {d.name}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: DIM_COLORS[i] }}>
                      {d.score}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-dim)",
                      marginBottom: 5,
                    }}
                  >
                    Weight: {Math.round(d.weight * 100)}%
                  </div>
                  {d.details.map((det, j) => (
                    <div
                      key={j}
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        paddingLeft: 7,
                        borderLeft: "1px solid var(--border-subtle)",
                        marginBottom: 1,
                      }}
                    >
                      {det}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── FLEET VIEW (Phase 3) ── */}
      {view === "fleet" && (
        <div className="fade-in">
          {/* Fleet summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <SummaryCard label="Total Agents" value={summary.total} />
            <SummaryCard label="Healthy" value={summary.healthy} color={STATUS_COLORS.healthy} />
            <SummaryCard label="Warning" value={summary.warning} color={STATUS_COLORS.warning} />
            <SummaryCard label="Critical" value={summary.critical} color={STATUS_COLORS.critical} />
            <SummaryCard label="Avg Score" value={summary.avgScore} />
            <SummaryCard label="Top Gap" value={summary.topGapField} small />
          </div>

          {fleet.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                border: "1px dashed var(--border-subtle)",
                borderRadius: 10,
              }}
            >
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                No agents in fleet
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Scan an agent config and click "Add to Fleet" to start building your fleet view.
              </p>
              <button
                onClick={() => setView("scan")}
                style={{
                  marginTop: 14,
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Run First Scan
              </button>
            </div>
          ) : (
            <>
              {/* Agent list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fleet.map((agent) => {
                  const status = getAgentStatus(agent.result.trust_score);
                  const gradeColor = GRADE_COLORS[agent.result.grade] || "#6b7280";
                  return (
                    <div
                      key={agent.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: `1px solid ${STATUS_COLORS[status]}22`,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onClick={() => handleViewFleetAgent(agent)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${STATUS_COLORS[status]}44`;
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${STATUS_COLORS[status]}22`;
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                      }}
                    >
                      {/* Status dot */}
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: STATUS_COLORS[status],
                          flexShrink: 0,
                          boxShadow: `0 0 6px ${STATUS_COLORS[status]}44`,
                        }}
                      />

                      {/* Score */}
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: gradeColor,
                          width: 42,
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        {agent.result.trust_score}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                          {agent.label || agent.id.slice(0, 12) + "..."}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                          {agent.result.agent_type} · {agent.result.risk_tier.replace(/_/g, " ")} ·{" "}
                          {agent.result.gaps.filter((g) => g.severity === "critical").length} critical gaps
                        </div>
                      </div>

                      {/* Grade */}
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: gradeColor,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: `1px solid ${gradeColor}33`,
                          flexShrink: 0,
                        }}
                      >
                        {agent.result.grade}
                      </div>

                      {/* Remove */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromFleet(agent.id);
                        }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--border-subtle)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          fontSize: 10,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          flexShrink: 0,
                        }}
                        title="Remove from fleet"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={handleClearFleet}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 5,
                    border: "1px solid rgba(239,68,68,0.2)",
                    background: "transparent",
                    color: "#fca5a5",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Clear Fleet
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer
        style={{
          marginTop: 40,
          paddingTop: 14,
          borderTop: "1px solid var(--border-subtle)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 10, color: "var(--text-dim)" }}>
          AgentRight · All scoring is rule-based and deterministic · No data leaves your browser · MIT License
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const size = 130;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = GRADE_COLORS[grade] || "#6b7280";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: size, height: size, transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={7}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontFamily: "var(--font-mono)",
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            marginTop: 2,
          }}
        >
          GRADE {grade}
        </span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: SEV_COLORS[severity],
        padding: "2px 5px",
        borderRadius: 3,
        background: `${SEV_COLORS[severity]}18`,
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      {severity}
    </span>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>▼</span> {title}
        {count !== undefined && (
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 400 }}>
            ({count})
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
      {text}
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        borderRadius: 5,
        border: "1px solid var(--border-subtle)",
        background: "transparent",
        color: disabled ? "var(--text-dim)" : "var(--text-secondary)",
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-mono)",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLElement).style.borderColor = "var(--border-focus)";
          (e.target as HTMLElement).style.color = "var(--cyan)";
        }
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.borderColor = "var(--border-subtle)";
        (e.target as HTMLElement).style.color = disabled ? "var(--text-dim)" : "var(--text-secondary)";
      }}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div
        style={{
          fontSize: small ? 12 : 20,
          fontWeight: 700,
          color: color || "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
