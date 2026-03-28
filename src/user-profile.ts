import type { UserProfile } from "@/types";
import { getProfile, upsertProfile } from "@/supabase";

const DEFAULT_PROFILE: UserProfile = {
  interests: ["AI", "Machine Learning", "Startups"],
  location: "Turin, Italy",
  budget: "under200",
  formatPreferences: ["conference", "meetup", "hackathon"],
  goal: "Stay up to date with AI developments and meet potential collaborators",
};

export async function getUserProfile(
  accessToken: string,
  userId: string,
): Promise<UserProfile> {
  const profile = await getProfile(accessToken, userId);
  if (!profile) {
    await upsertProfile(accessToken, userId, DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE };
  }
  return profile;
}

export function isDefaultProfile(profile: UserProfile): boolean {
  return (
    JSON.stringify(profile.interests) === JSON.stringify(DEFAULT_PROFILE.interests) &&
    profile.location === DEFAULT_PROFILE.location &&
    profile.budget === DEFAULT_PROFILE.budget &&
    profile.goal === DEFAULT_PROFILE.goal
  );
}

export async function updateUserProfile(
  accessToken: string,
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  const current = await getUserProfile(accessToken, userId);
  const merged = { ...current, ...updates };
  await upsertProfile(accessToken, userId, merged);
  return merged;
}
