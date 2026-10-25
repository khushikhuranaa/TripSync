import type { AvatarTone, PlatformRole } from "@/lib/types";

/**
 * The signed-in identity, reduced to the few fields the interface needs.
 * This type is safe to import from client components.
 */
export interface SessionProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
  tone: AvatarTone;
  platformRole: PlatformRole;
  homeCity: string;
  travelStyle: "Relaxed" | "Balanced" | "Packed";
  dietaryNotes: string;
  joinedAt: string;
}

export const SIGNED_IN_HOME = "/preview/dashboard";

/**
 * Only same-site paths may be used as a post-sign-in destination.
 * A value such as `//evil.example` or `https://…` falls back to the dashboard,
 * which prevents the sign-in form from becoming an open redirect.
 */
export function safeNextPath(value: string | string[] | undefined | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return SIGNED_IN_HOME;
  if (!raw.startsWith("/") || raw.startsWith("//")) return SIGNED_IN_HOME;
  // URL parsers strip tabs/newlines and treat `\` as `/`, so values such as
  // "/\evil.com" or "/<tab>/evil.com" would resolve off-site. Same-site app
  // paths never contain those characters, so refuse them outright.
  if (/[\u0000-\u001f\u007f\s\\]/.test(raw)) return SIGNED_IN_HOME;
  if (raw.startsWith("/sign-in") || raw.startsWith("/sign-up")) {
    return SIGNED_IN_HOME;
  }
  return raw;
}
