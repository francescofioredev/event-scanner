export type EventFormat = "conference" | "meetup" | "hackathon" | "workshop" | "webinar";
export type PriceType = "free" | "paid";
export type EventSource = "eventbrite" | "luma" | "mock";

export interface EventCard {
  id: string;
  title: string;
  date: string;
  location: string;
  format: EventFormat;
  price: PriceType;
  priceAmount?: number;
  currency?: string;
  topics: string[];
  fitScore: number;
  fitReason: string;
  attendeeProfile: string;
  source: EventSource;
  url?: string;
}

export interface ScoreBreakdown {
  topic: number;
  attendees: number;
  schedule: number;
  budget: number;
  size: number;
}

export interface EventDetail extends EventCard {
  description: string;
  agenda: string[];
  perks: string[];
  logistics: {
    venue: string;
    duration: string;
    capacity?: number;
    website?: string;
  };
  scoreBreakdown: ScoreBreakdown;
}

export type BudgetRange = "free" | "under50" | "under200" | "any";

export interface UserProfile {
  interests: string[];
  location: string;
  budget: BudgetRange;
  formatPreferences: EventFormat[];
  goal: string;
}
