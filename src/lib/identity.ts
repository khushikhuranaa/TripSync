import type { AvatarTone } from "@/lib/types";

/**
 * Pure identity helpers shared by server data loading and auth screens.
 * Kept free of database imports so they can run anywhere.
 */

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TS";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const TONES: AvatarTone[] = ["forest", "clay", "sage", "sand", "ink"];

export function toneForId(id: string): AvatarTone {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return TONES[hash % TONES.length];
}
