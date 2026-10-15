/** Error class only. Strips token-shaped text before anything is shown or logged. */
export function publicErrorClass(status: number, body: string): string {
  let code = `http_${status}`;
  try {
    const parsed = JSON.parse(body) as {
      code?: unknown;
      error?: { type?: unknown; code?: unknown };
    };
    if (typeof parsed.code === 'string' && parsed.code.trim()) code = parsed.code.trim();
    else if (typeof parsed.error?.type === 'string' && parsed.error.type.trim()) code = parsed.error.type.trim();
    else if (typeof parsed.error?.code === 'string' && parsed.error.code.trim()) code = parsed.error.code.trim();
  } catch {
    if (body.trim()) code = `http_${status}`;
  }
  return code
    .replace(/sk-[A-Za-z0-9_-]+/g, '')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}
