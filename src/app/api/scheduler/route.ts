import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

interface StatusFile {
  armed?: boolean;
  pid?: number;
  nextFireIso?: string;
  nextWindowLabel?: string;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const raw = await readFile(path.join(process.cwd(), 'data', 'scheduler-status.json'), 'utf8');
    const status = JSON.parse(raw) as StatusFile;
    const alive = typeof status.pid === 'number' && pidAlive(status.pid);
    return Response.json({
      armed: Boolean(status.armed && alive),
      nextFireIso: status.nextFireIso ?? '',
      nextWindowLabel: status.nextWindowLabel ?? '',
    });
  } catch {
    return Response.json({ armed: false, nextFireIso: '', nextWindowLabel: '' });
  }
}
