"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionProfile } from "@/lib/session";

/**
 * The signed-in identity, loaded on the server and handed to client components.
 *
 * This is display data only. It is never used to decide whether an operation is
 * allowed — the server actions and route handlers re-check the session and trip
 * membership on every call.
 */
const SessionContext = createContext<SessionProfile | null>(null);

export function SessionProvider({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={profile}>{children}</SessionContext.Provider>
  );
}

export function useSessionProfile() {
  return useContext(SessionContext);
}
