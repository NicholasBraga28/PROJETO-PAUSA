import { z } from "zod";
import { request } from "@/shared/api/client";
import { User, type Role, type UserStatus } from "@/shared/api/schemas";

export interface UserFilters {
  role: Role | "";
  status: UserStatus | "";
  search: string;
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
}

export async function getUsers(filters: UserFilters) {
  const query = new URLSearchParams();
  if (filters.role) query.set("role", filters.role);
  if (filters.status) query.set("status", filters.status);
  if (filters.search.trim()) query.set("search", filters.search.trim());
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/users${suffix}`, z.array(User));
}

export const createUser = (input: NewUser) => request("/users", User, { method: "POST", body: input });

export const updateUserStatus = (id: string, status: UserStatus) =>
  request(`/users/${encodeURIComponent(id)}/status`, User, { method: "PATCH", body: { status } });
