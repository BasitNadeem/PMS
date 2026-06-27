import { useMemo } from "react";
import { getCurrentUserPermissions } from "@/lib/jwt";

export interface UsePermissionsResult {
  permissions: string[];
  has: (key: string) => boolean;
  hasAny: (keys: string[]) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const permissions = useMemo(() => getCurrentUserPermissions(), []);

  return useMemo(() => ({
    permissions,
    has: (key: string) => permissions.includes(key),
    hasAny: (keys: string[]) => keys.some((key) => permissions.includes(key)),
  }), [permissions]);
}
