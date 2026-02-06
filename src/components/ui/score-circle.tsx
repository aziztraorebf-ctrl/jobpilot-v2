import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    container: "size-10",
    text: "text-xs",
    strokeWidth: 3,
    radius: 16,
  },
  md: {
    container: "size-14",
    text: "text-sm font-semibold",
    strokeWidth: 3.5,
    radius: 22,
  },
  lg: {
    container: "size-20",
    text: "text-lg font-bold",
    strokeWidth: 4,
    radius: 32,
  },
} as const;

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function getStrokeColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

function getTrackColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500/20";
  if (score >= 60) return "stroke-amber-500/20";
  return "stroke-red-500/20";
}

export function ScoreCircle({ score, size = "md" }: ScoreCircleProps) {
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const viewBoxSize = (config.radius + config.strokeWidth) * 2;
  const center = viewBoxSize / 2;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        config.container
      )}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        fill="none"
      >
        <circle
          cx={center}
          cy={center}
          r={config.radius}
          className={cn("fill-none", getTrackColor(score))}
          strokeWidth={config.strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={config.radius}
          className={cn(
            "fill-none transition-all duration-500",
            getStrokeColor(score)
          )}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={cn("relative z-10", config.text, getScoreColor(score))}>
        {clampedScore}
      </span>
    </div>
  );
}
