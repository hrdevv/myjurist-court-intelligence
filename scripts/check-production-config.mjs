const demoLegalOutputs = process.env.VITE_DEMO_LEGAL_OUTPUTS;
const allowDemoLegalOutputsInBuild = process.env.VITE_ALLOW_DEMO_LEGAL_OUTPUTS_IN_BUILD;
const lifecycleEvent = process.env.npm_lifecycle_event;
const nodeEnv = process.env.NODE_ENV;

if (
  demoLegalOutputs === "enabled" &&
  (nodeEnv === "production" || lifecycleEvent === "build") &&
  allowDemoLegalOutputsInBuild !== "yes"
) {
  console.error(
    [
      "Production configuration is unsafe:",
      "VITE_DEMO_LEGAL_OUTPUTS=enabled exposes mock/demo legal outputs.",
      "Disable it before deploying production, or set VITE_ALLOW_DEMO_LEGAL_OUTPUTS_IN_BUILD=yes only for isolated demo builds.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Production configuration check passed.");
