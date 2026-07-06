/**
 * AgentRight Fleet Manager
 * Manages a collection of scanned agents with local persistence.
 * Free tier: 1 agent. Team tier: 10 agents.
 */

import type {
  FleetAgent,
  FleetSummary,
  FleetStatus,
  ScanResult,
  AgentIdentity,
} from "@agentright/core";

const STORAGE_KEY = "agentright_fleet";
const MAX_AGENTS_FREE = 1;
const MAX_AGENTS_TEAM = 10;

export function getFleet(): FleetAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFleet(fleet: FleetAgent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fleet));
}

export function addToFleet(
  config: Partial<AgentIdentity>,
  result: ScanResult,
  label?: string
): { success: boolean; message: string; fleet: FleetAgent[] } {
  const fleet = getFleet();

  // Check for duplicate agent_id
  const existing = fleet.findIndex(
    (a) => a.id === result.agent_id
  );
  if (existing >= 0) {
    // Update existing
    fleet[existing] = {
      id: result.agent_id,
      config,
      result,
      addedAt: new Date().toISOString(),
      label: label || fleet[existing].label,
    };
    saveFleet(fleet);
    return {
      success: true,
      message: `Updated agent ${result.agent_id.slice(0, 8)}...`,
      fleet,
    };
  }

  // For now, use team limit (no auth yet)
  if (fleet.length >= MAX_AGENTS_TEAM) {
    return {
      success: false,
      message: `Fleet limit reached (${MAX_AGENTS_TEAM} agents). Remove an agent to add a new one.`,
      fleet,
    };
  }

  fleet.push({
    id: result.agent_id,
    config,
    result,
    addedAt: new Date().toISOString(),
    label,
  });

  saveFleet(fleet);
  return {
    success: true,
    message: `Added agent ${result.agent_id.slice(0, 8)}... to fleet`,
    fleet,
  };
}

export function removeFromFleet(agentId: string): FleetAgent[] {
  const fleet = getFleet().filter((a) => a.id !== agentId);
  saveFleet(fleet);
  return fleet;
}

export function clearFleet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getAgentStatus(score: number): FleetStatus {
  if (score >= 75) return "healthy";
  if (score >= 50) return "warning";
  return "critical";
}

export function getFleetSummary(fleet: FleetAgent[]): FleetSummary {
  if (fleet.length === 0) {
    return {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      avgScore: 0,
      worstAgent: "none",
      topGapField: "none",
    };
  }

  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let totalScore = 0;
  let worstScore = 101;
  let worstAgent = "";

  // Count gap fields across all agents
  const gapFieldCounts: Record<string, number> = {};

  for (const agent of fleet) {
    const status = getAgentStatus(agent.result.trust_score);
    if (status === "healthy") healthy++;
    else if (status === "warning") warning++;
    else critical++;

    totalScore += agent.result.trust_score;

    if (agent.result.trust_score < worstScore) {
      worstScore = agent.result.trust_score;
      worstAgent = agent.id;
    }

    for (const gap of agent.result.gaps) {
      // Normalize field name (strip array indices)
      const baseField = gap.field.replace(/\[\d+\].*/, "");
      gapFieldCounts[baseField] =
        (gapFieldCounts[baseField] || 0) + 1;
    }
  }

  // Find most common gap field
  let topGapField = "none";
  let topGapCount = 0;
  for (const [field, count] of Object.entries(gapFieldCounts)) {
    if (count > topGapCount) {
      topGapCount = count;
      topGapField = field;
    }
  }

  return {
    total: fleet.length,
    healthy,
    warning,
    critical,
    avgScore: Math.round(totalScore / fleet.length),
    worstAgent,
    topGapField,
  };
}
