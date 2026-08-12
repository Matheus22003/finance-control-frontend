import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const scriptPath = fileURLToPath(new URL('./run-e2e-isolated.ps1', import.meta.url));
const result = spawnSync(
  powershell,
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(`Não foi possível iniciar ${powershell}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
