import { chatCompletionsUrl, deepseekUserPayload, httpsApiBase, parseDeepseekLaneNotes, DEFAULT_DEEPSEEK_BASE, type DeepseekReadBody, type ReaderLaneNote } from '@/core/daily/analysis-reader';
import { publicErrorClass } from '@/core/safety/redact';

export interface DeepseekAccess {
  key: string;
  base: string;
  source: 'browser' | 'env';
}

/**
 * Browser key wins. An empty browser key falls back to the server env, then to nothing.
 * The key stays in this object and must not be logged.
 */
export function resolveDeepseekAccess(input: {
  browserKey?: string | null;
  browserBase?: string | null;
  env?: Record<string, string | undefined>;
}): DeepseekAccess | null {
  const env = input.env ?? {};
  const browserKey = input.browserKey?.trim() ?? '';
  const envKey = env.DEEPSEEK_API_KEY?.trim() ?? '';
  const key = browserKey || envKey;
  if (!key) return null;
  const browserBase = input.browserBase?.trim() ?? '';
  const envBase = env.DEEPSEEK_API_BASE?.trim() ?? '';
  return {
    key,
    base: httpsApiBase(browserBase || envBase || DEFAULT_DEEPSEEK_BASE),
    source: browserKey ? 'browser' : 'env',
  };
}

export async function completeDeepseekRead(
  access: DeepseekAccess,
  body: DeepseekReadBody,
): Promise<{ ok: true; notes: ReaderLaneNote[] } | { ok: false; errorClass: string }> {
  const payload = deepseekUserPayload(body);
  try {
    const response = await fetch(chatCompletionsUrl(access.base), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'Return one JSON object only. Do not use tools. Do not invent procedures.',
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, errorClass: publicErrorClass(response.status, text) };
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    return { ok: true, notes: parseDeepseekLaneNotes(content) };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, errorClass: name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}
