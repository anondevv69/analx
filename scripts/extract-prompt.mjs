import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const s = fs.readFileSync(path.join(root, 'ai-agent/server.js'), 'utf8');
const m = s.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!m) throw new Error('SYSTEM_PROMPT not found');
const out = `// Synced from ai-agent/server.js — edit the source of truth in ai-agent or update both.\nmodule.exports.SYSTEM_PROMPT = \`${m[1].replace(/`/g, '\\`')}\`;\n`;
fs.writeFileSync(path.join(root, 'api/prompt.js'), out);
