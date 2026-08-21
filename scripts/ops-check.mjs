import { spawn } from 'node:child_process';

const checks = [
  ['schema:check', ['npm', 'run', 'schema:check']],
  ['typecheck', ['npm', 'run', 'typecheck']],
];

for (const [label, command] of checks) {
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code ?? 1}`));
    });
  });
}

console.log('ops-check passed');
