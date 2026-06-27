interface AccessTokenPayload {
  userId: string;
  hotelId: string;
  role: string;
  permissions: string[];
  isFirstLogin: boolean;
}

// Decode the JWT payload without a round-trip. The JWT is stored in localStorage by the auth layer.
export function decodeToken(): AccessTokenPayload | null {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function getCurrentUserRole(): string | null {
  return decodeToken()?.role ?? null;
}

export function getCurrentUserPermissions(): string[] {
  return decodeToken()?.permissions ?? [];
}

// Name is captured at login (not part of the JWT) and cached in localStorage.
export function getCurrentUserName(): string | null {
  return localStorage.getItem("userName");
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:        "Owner",
  MANAGER:      "Manager",
  FRONT_DESK:   "Front Desk",
  HOUSEKEEPING: "Housekeeping",
  KITCHEN:      "Kitchen",
  MAINTENANCE:  "Maintenance",
  ACCOUNTANT:   "Accountant",
};

export function formatRoleLabel(role: string | null): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}

export function getInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
