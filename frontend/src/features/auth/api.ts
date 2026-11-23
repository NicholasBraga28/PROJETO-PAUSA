import { z } from "zod";
import { request } from "@/shared/api/client";
import { DemoUser, Profile } from "@/shared/api/schemas";

export const getDemoUsers = () => request("/auth/demo-users", z.array(DemoUser));
export const getMe = () => request("/me", Profile);
