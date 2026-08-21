import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error('SUPABASE_DB_URL is required');
const directory = resolve(process.env.BACKUP_DIR ?? './backups');
await mkdir(directory, { recursive: true });
const file = resolve(directory, `group-bot-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--file', file, databaseUrl], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
