import type { Role } from "@/shared/api/schemas";

export const ROLE_HOME: Record<Role, string> = { EMPLOYEE: "/", THERAPIST: "/therapist", HR: "/hr", ADMIN: "/admin" };

export const SIGN_IN_PATH = "/sign-in";
