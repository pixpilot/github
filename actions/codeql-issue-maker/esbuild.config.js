const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/action.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    outdir: "dist",
    format: "cjs",
    sourcemap: false,
    tsconfig: "tsconfig.json",
    logLevel: "info",
  })
  .catch(() => process.exit(1));
