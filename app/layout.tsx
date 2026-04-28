import type { Metadata } from "next";
import { SettingsMenu } from "@/components/SettingsMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "議決権行使 反対可能性分析",
  description:
    "投資家別ガイドライン、企業データ、候補者属性、過去行使結果から反対可能性を論点別に表示します。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
            <a href="/" className="font-bold text-slate-950">
              議決権行使 反対可能性分析
            </a>
            <nav className="ml-auto flex items-center gap-3 text-sm text-slate-600">
              <a className="hover:text-slate-950" href="/">
                企業検索
              </a>
              <a className="hover:text-slate-950" href="/screen">
                スクリーニング
              </a>
              <SettingsMenu />
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-screen max-w-6xl px-5 py-6">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-center text-xs text-slate-500">
          分析支援ツールです。実際の行使判断では、各投資家の最新公式資料と個別事情を確認してください。
        </footer>
      </body>
    </html>
  );
}
