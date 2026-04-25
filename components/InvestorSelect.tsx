"use client";

import { useRouter } from "next/navigation";
import type { Investor } from "@/lib/types";

interface InvestorSelectProps {
  investors: Investor[];
  companyCode: string;
  meetingYear: number;
  selectedInvestor?: string;
  voteView: string;
}

export function InvestorSelect({
  investors,
  companyCode,
  meetingYear,
  selectedInvestor,
  voteView,
}: InvestorSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">投資家</span>
      <select
        value={selectedInvestor ?? "all"}
        onChange={(event) => {
          const params = new URLSearchParams({
            year: String(meetingYear),
            voteView,
          });
          if (event.target.value !== "all") {
            params.set("investor", event.target.value);
          }
          router.push(`/companies/${companyCode}?${params.toString()}`, { scroll: false });
        }}
        className="min-w-[260px] rounded border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-500"
      >
        <option value="all">全投資家を表示</option>
        {investors.map((investor) => (
          <option key={investor.investor_id} value={investor.investor_id}>
            {investor.investor_name}
          </option>
        ))}
      </select>
    </label>
  );
}
