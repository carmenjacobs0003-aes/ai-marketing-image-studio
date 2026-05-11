import { spawnSync } from "node:child_process";

const checks = [
  ["TypeScript", "npm", ["run", "typecheck"]],
  ["Next build", "npm", ["run", "build"]]
];

let failed = false;
for (const [label, command, args] of checks) {
  console.log(`\n[diagnostics] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
