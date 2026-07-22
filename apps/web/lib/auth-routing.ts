type AuthUser = {
  role: string;
  activationStatus: string;
};

export function dashboardPathForUser(user: AuthUser) {
  if (user.activationStatus !== "ACTIVE") return "/activate";
  if (user.role === "SCANNER") return "/scanner";
  if (user.role === "CLIENT") return "/client";
  if (user.role === "ADMIN") return "/admin";
  return "/activate";
}
