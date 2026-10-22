import type { CommunityStatus } from "@/shared/contracts";
import { statusLabel } from "./filter";

const PILL_STYLE: Record<CommunityStatus, string> = {
  participating: "bg-[#4334F5] text-white",
  connected: "bg-[#18181C] text-white",
  listed: "bg-white text-[#55555D] border border-solid border-[#DEDEE5]",
};

export function StatusPill({ status, className = "" }: { status: CommunityStatus; className?: string }) {
  return (
    <span
      className={`inline-block flex-none rounded-full px-[10px] py-[3px] text-[13px] font-semibold ${PILL_STYLE[status]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
