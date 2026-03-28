import type { EventCard, EventFormat, PriceType } from "@/types";

export function inferFormat(text: string): EventFormat {
  const t = text.toLowerCase();
  if (t.includes("hackathon") || t.includes("hack")) return "hackathon";
  if (t.includes("workshop") || t.includes("bootcamp") || t.includes("hands-on")) return "workshop";
  if (t.includes("webinar") || t.includes("online talk") || t.includes("livestream")) return "webinar";
  if (t.includes("meetup") || t.includes("meet-up") || t.includes("networking") || t.includes("dinner") || t.includes("social")) return "meetup";
  return "conference";
}

export function extractTopicsFromText(text: string): string[] {
  const topicKeywords = [
    "AI", "Machine Learning", "LLM", "Agents", "Deep Learning", "NLP",
    "React", "JavaScript", "TypeScript", "Frontend", "Backend", "Full Stack",
    "Python", "Rust", "Go", "DevOps", "Cloud", "AWS", "Kubernetes",
    "Blockchain", "Web3", "Crypto", "DeFi",
    "Design", "UX", "UI", "Product", "Figma",
    "Startups", "Fundraising", "VC", "Networking", "Entrepreneurship",
    "Data Science", "Analytics", "Big Data",
    "Security", "Cybersecurity", "Privacy",
    "Mobile", "iOS", "Android", "Flutter", "React Native",
    "Open Source", "Linux", "Community",
    "SaaS", "B2B", "Marketing", "Growth", "Sales",
    "Healthcare", "Fintech", "EdTech", "Climate",
  ];
  const lower = text.toLowerCase();
  return topicKeywords.filter((kw) => lower.includes(kw.toLowerCase())).slice(0, 5);
}

export interface EnrichmentHints {
  phqRank?: number;       // 0–100 event significance from PredictHQ
  phqAttendance?: number; // predicted attendance from PredictHQ
}

export function computeFitScore(
  event: Partial<EventCard>,
  query: string,
  enrichment: EnrichmentHints = {}
): { fitScore: number; fitReason: string } {
  let score = 50;
  const reasons: string[] = [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const titleLower = (event.title || "").toLowerCase();
  const topicsLower = (event.topics || []).map((t) => t.toLowerCase());
  const locationLower = (event.location || "").toLowerCase();

  const matchedTerms = queryTerms.filter(
    (t) => titleLower.includes(t) || topicsLower.some((topic) => topic.includes(t)) || locationLower.includes(t)
  );
  if (matchedTerms.length > 0) {
    score += matchedTerms.length * 12;
    reasons.push(`Matches: ${matchedTerms.join(", ")}`);
  }

  if ((event.topics || []).length >= 3) {
    score += 5;
  }

  if (event.price === "free") {
    score += 5;
    reasons.push("free entry");
  }

  // PredictHQ enrichment signals
  if (enrichment.phqRank != null) {
    // phqRank 0–100: scale to a ±10 bonus (rank 50 = neutral, 100 = +10)
    const rankBonus = Math.round((enrichment.phqRank - 50) / 5);
    score += rankBonus;
    if (rankBonus > 0) reasons.push(`high-significance event (rank ${enrichment.phqRank})`);
  }

  if (enrichment.phqAttendance != null && enrichment.phqAttendance >= 1000) {
    score += 5;
    reasons.push(`large event (~${enrichment.phqAttendance.toLocaleString()} attendees)`);
  }

  score = Math.min(100, Math.max(0, score));
  const reasonText = reasons.length > 0 ? reasons.join(". ") + "." : "General event match based on search criteria.";

  return { fitScore: score, fitReason: reasonText };
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function filterByQuery(events: EventCard[], query: string): EventCard[] {
  const q = query.toLowerCase();
  return events.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.topics.some((t) => t.toLowerCase().includes(q)) ||
      e.location.toLowerCase().includes(q) ||
      e.format.toLowerCase().includes(q) ||
      e.attendeeProfile.toLowerCase().includes(q)
  );
}
