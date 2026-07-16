import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
const dbPath = path.join(projectRoot, 'local-db.json');

console.log('Agent launcher using DB_FILE_PATH:', dbPath);

const child = spawn('npx', ['adk', 'api_server'], {
  cwd: __dirname,
  env: { ...process.env, DB_FILE_PATH: dbPath },
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
