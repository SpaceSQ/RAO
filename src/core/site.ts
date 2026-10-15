const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');

/** Public site. Override with NEXT_PUBLIC_SITE_URL; empty keeps this host. */
export const PUBLIC_HOST = configuredSite || 'https://rao.space2.world';
export const CHANNEL_BRAND = '千家网人工智能频道 · 红锚观察者';
export const EXPERIMENT_NOTE =
  '实验性观测服务。不是面向终端用户、政府或安全监管机构的开源软件。';
export const MANUAL_PUBLISH_NOTE =
  '当日报告由工作人员复制后，在千家网新闻发布平台手工发布。本系统不调用该平台。';
export const LOCAL_HISTORY_NOTE =
  '在线库未接通。时间线来自本机种子回放，不是 Supabase 上的历史存档。';
export const ONLINE_HISTORY_NOTE = '历史来自 Supabase 在线库。';

export type Surface = 'public' | 'admin' | 'embed-report' | 'embed-data';

/** Only the signed-in operator may change monitoring state. */
export function surfaceAllowsWrite(surface: Surface): boolean {
  return surface === 'admin';
}
