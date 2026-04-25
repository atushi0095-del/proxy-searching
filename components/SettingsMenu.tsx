"use client";

import { useState } from "react";
import Link from "next/link";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        aria-expanded={open}
      >
        設定
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border bg-white p-2 text-sm shadow-lg">
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href="/">
            全体ダッシュボード
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href="/investors/blackrock">
            投資家ルール一覧
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href="/settings">
            収集・分析設定
          </Link>
          <p className="mt-1 border-t px-3 pt-2 text-xs leading-5 text-slate-500">
            収集は公式公開資料を低頻度で確認し、ログイン・CAPTCHA・非公開API・個人情報収集は行いません。
          </p>
        </div>
      )}
    </div>
  );
}
