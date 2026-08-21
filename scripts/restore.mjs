import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error('SUPABASE_DB_URL is required');

const backupFile = process.env.BACKUP_FILE;
if (!backupFile) throw new Error('BACKUP_FILE is required');

const file = resolve(backupFile);
await access(file);

const child = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', databaseUrl, file], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
