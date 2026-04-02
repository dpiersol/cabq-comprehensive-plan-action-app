import { useSyncExternalStore } from "react";
import {
  getAuthUser,
  isAdmin,
  subscribeAuth,
  type AuthUser,
} from "./auth";

export function useAuth(): { user: AuthUser | null; isAdmin: boolean } {
  const user = useSyncExternalStore(subscribeAuth, getAuthUser, () => null);
  const admin = useSyncExternalStore(subscribeAuth, isAdmin, () => false);
  return { user, isAdmin: admin };
}
