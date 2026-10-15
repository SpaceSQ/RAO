import type { Metadata } from 'next';
import { PUBLIC_HOST } from '@/core/site';
import './globals.css';

export const metadata: Metadata = {
  title: '千家网人工智能频道 · 红锚观察者',
  description: `${PUBLIC_HOST} 上的实验性只读观测。零主动干预。`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
