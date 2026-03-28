import type { UserProfile } from "@/types";

const DEFAULT_PROFILE: UserProfile = {
  interests: ["AI", "Machine Learning", "Startups"],
  location: "Turin, Italy",
  budget: "under200",
  formatPreferences: ["conference", "meetup", "hackathon"],
  goal: "Stay up to date with AI developments and meet potential collaborators",
};

let currentProfile: UserProfile = { ...DEFAULT_PROFILE };

export function getUserProfile(): UserProfile {
  return { ...currentProfile };
}

export function updateUserProfile(updates: Partial<UserProfile>): UserProfile {
  currentProfile = { ...currentProfile, ...updates };
  return { ...currentProfile };
}
