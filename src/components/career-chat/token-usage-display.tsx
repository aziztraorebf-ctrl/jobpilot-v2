import { cn } from "@/lib/utils";

interface TokenUsageDisplayProps {
  tokensUsed: number;
  tokenLimit?: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
}

const sizeConfig = {
  sm: {
    container: "px-2 py-1",
    text: "text-xs",
    label: "text-[10px]",
  },
  md: {
    container: "px-3 py-1.5",
    text: "text-sm",
    label: "text-xs",
  },
  lg: {
    container: "px-4 py-2",
    text: "text-base",
    label: "text-sm",
  },
} as const;

function getUsageLevel(tokensUsed: number, tokenLimit?: number): number {
  if (!tokenLimit) {
    // Without a limit, use absolute thresholds
    if (tokensUsed < 1000) return 0; // Low
    if (tokensUsed < 5000) return 1; // Medium
    return 2; // High
  }

  const percentage = (tokensUsed / tokenLimit) * 100;
  if (percentage < 60) return 0; // Low
  if (percentage < 85) return 1; // Medium
  return 2; // High
}

function getUsageColor(level: number): string {
  if (level === 0) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (level === 1) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-red-500/10 text-red-700 dark:text-red-400";
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function TokenUsageDisplay({
  tokensUsed,
  tokenLimit,
  size = "md",
  showPercentage = false,
}: TokenUsageDisplayProps) {
  const config = sizeConfig[size];
  const usageLevel = getUsageLevel(tokensUsed, tokenLimit);
  const colorClass = getUsageColor(usageLevel);

  const percentage = tokenLimit
    ? Math.round((tokensUsed / tokenLimit) * 100)
    : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
        config.container,
        config.text,
        colorClass
      )}
    >
      <svg
        className="size-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span>
        {formatTokenCount(tokensUsed)}
        {tokenLimit && ` / ${formatTokenCount(tokenLimit)}`}
        {showPercentage && percentage !== null && ` (${percentage}%)`}
      </span>
      <span className={cn("opacity-60", config.label)}>
        {tokensUsed === 1 ? "token" : "tokens"}
      </span>
    </div>
  );
}
