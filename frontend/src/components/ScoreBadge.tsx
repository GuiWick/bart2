interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "lg";
}

function scoreToColor(score: number) {
  if (score >= 80) return "bg-near-green-muted text-near-green-text border-near-green/40";
  if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const color = scoreToColor(score);
  const sizeClass = size === "lg"
    ? "text-3xl font-bold px-4 py-2"
    : "text-sm font-semibold px-2 py-0.5";
  return (
    <span className={`inline-block rounded-full border ${color} ${sizeClass}`}>
      {score}
    </span>
  );
}

interface RatingBadgeProps {
  rating: string;
  size?: "sm" | "lg";
}

function ratingToColor(rating: string) {
  switch (rating) {
    case "A": return "bg-near-green-muted text-near-green-text border-near-green/40";
    case "B": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "C": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "D": return "bg-orange-100 text-orange-800 border-orange-200";
    case "F": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function RatingBadge({ rating, size = "sm" }: RatingBadgeProps) {
  const color = ratingToColor(rating);
  const sizeClass = size === "lg"
    ? "text-4xl font-black w-16 h-16 flex items-center justify-center"
    : "text-sm font-bold px-2 py-0.5";
  return (
    <span className={`inline-flex rounded-full border ${color} ${sizeClass}`}>
      {rating}
    </span>
  );
}

interface SentimentBadgeProps {
  sentiment: string;
}

export function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const styles = {
    positive: "bg-near-green-muted text-near-green-text",
    neutral: "bg-gray-100 text-gray-700",
    negative: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[sentiment as keyof typeof styles] || styles.neutral}`}>
      {sentiment}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-near-green-muted text-near-green-text",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[severity as keyof typeof styles] || "bg-gray-100 text-gray-700"}`}>
      {severity}
    </span>
  );
}
