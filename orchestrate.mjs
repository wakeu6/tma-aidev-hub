import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vsDir = path.join(__dirname, 'video-shorts');

const child = spawn(process.execPath, [path.join(vsDir, 'orchestrate.mjs'), ...process.argv.slice(2)], {
  cwd: vsDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
