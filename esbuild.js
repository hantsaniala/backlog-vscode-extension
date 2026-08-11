const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const options = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: "info",
  target: "node18",
};

const builds = [
  {
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    external: ["vscode"],
  },
  {
    // Shared parser bundled for the browser preview server (Node).
    entryPoints: ["src/parser.ts"],
    outfile: "preview/parser.cjs",
    platform: "node",
    format: "cjs",
  },
];

async function main() {
  if (watch) {
    for (const b of builds) {
      const ctx = await esbuild.context({ ...options, ...b });
      await ctx.watch();
    }
  } else {
    for (const b of builds) {
      await esbuild.build({ ...options, ...b });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
