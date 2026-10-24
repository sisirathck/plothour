import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const processes = [
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, ['--watch', '--watch-path=.env', resolve(root, 'server/index.js')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
];

let stopping = false;

const stop = (signal = 'SIGTERM', exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed && child.exitCode === null) child.kill(signal);
  }
  process.exitCode = exitCode;
};

for (const child of processes) {
  child.on('error', (error) => {
    console.error('[StudyDuel dev] Failed to start a service:', error.message);
    stop('SIGTERM', 1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`[StudyDuel dev] A service exited (${signal || code}).`);
      stop('SIGTERM', code || 1);
    }
  });
}

process.on('SIGINT', () => stop('SIGINT', 130));
process.on('SIGTERM', () => stop('SIGTERM', 143));
