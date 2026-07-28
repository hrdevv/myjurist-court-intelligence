/**
 * Explicit gate for routes and UI sections that still render mock/demo legal
 * outputs. Keep this opt-in so production environments cannot accidentally
 * present demo AI claims, reports, or team data as live case material.
 */
export const DEMO_LEGAL_OUTPUTS_ENABLED =
  import.meta.env.VITE_DEMO_LEGAL_OUTPUTS === "enabled";

export function requireDemoLegalOutputs() {
  return DEMO_LEGAL_OUTPUTS_ENABLED;
}
