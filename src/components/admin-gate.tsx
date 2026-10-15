'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Workbench } from '@/components/workbench';
import { CHANNEL_BRAND, EXPERIMENT_NOTE, PUBLIC_HOST } from '@/core/site';

export function AdminGate() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'in'>('checking');
  const [username, setUsername] = useState('rao-admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/session')
      .then((response) => {
        if (cancelled) return;
        setPhase(response.ok ? 'in' : 'login');
      })
      .catch(() => {
        if (!cancelled) setPhase('login');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (response.status === 503) {
      setError('本机还没有配置管理员口令。');
      return;
    }
    if (!response.ok) {
      setError('口令不正确。没有注册入口。');
      return;
    }
    setPassword('');
    setPhase('in');
  }

  if (phase === 'checking') {
    return <p className="px-6 py-8 text-sm text-mute">正在核对管理员会话。</p>;
  }

  if (phase === 'login') {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="font-mono text-[11px] tracking-[0.16em] text-diode">{PUBLIC_HOST}</p>
        <h1 className="mt-2 text-xl font-semibold text-white">{CHANNEL_BRAND}</h1>
        <p className="mt-2 text-sm text-mute">{EXPERIMENT_NOTE}</p>
        <form onSubmit={submit} className="panel mt-6 px-4 py-4" data-testid="admin-login">
          <h2 className="text-sm font-semibold text-white">系统管理员登录</h2>
          <p className="mt-1 text-xs text-mute">只有一个预置账号。不能注册，也没有第二个账号入口。</p>
          <label className="mt-4 block text-xs text-mute">
            账号
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="mt-3 block text-xs text-mute">
            口令
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              data-testid="admin-password"
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-anchor">{error}</p> : null}
          <button type="submit" className="mt-4 rounded-md bg-anchor px-4 py-2 text-sm font-semibold text-white">
            进入控制台
          </button>
        </form>
      </main>
    );
  }

  return (
    <div>
      <div className="mx-auto flex max-w-[1440px] items-center justify-end px-4 pt-3 md:px-6">
        <button
          type="button"
          className="text-xs text-mute"
          onClick={() => {
            void fetch('/api/admin/logout', { method: 'POST' }).then(() => setPhase('login'));
          }}
        >
          退出管理员
        </button>
      </div>
      <Workbench surface="admin" />
    </div>
  );
}
