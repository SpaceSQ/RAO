import { DEFAULT_DEEPSEEK_BASE, httpsApiBase } from '@/core/daily/analysis-reader';

export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
  const baseRaw = process.env.DEEPSEEK_API_BASE?.trim() || DEFAULT_DEEPSEEK_BASE;
  let base = DEFAULT_DEEPSEEK_BASE;
  try {
    base = httpsApiBase(baseRaw);
  } catch {
    base = DEFAULT_DEEPSEEK_BASE;
  }
  return Response.json({ configured: Boolean(key), base });
}
