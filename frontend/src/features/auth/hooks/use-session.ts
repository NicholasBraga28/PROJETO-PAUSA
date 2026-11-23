import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/shared/api/api-error";
import type { DemoUser, Profile, Role } from "@/shared/api/schemas";
import { getDemoUsers, getMe } from "@/features/auth/api";
import { readUser, rememberUser } from "@/features/auth/session-storage";

export type SessionProfile = Profile & { roleLabel: string };

type SessionState =
  | { status: "loading" | "out"; profile: null; notice: string | null }
  | { status: "in"; profile: SessionProfile; notice: null };

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Colaborador",
  THERAPIST: "Massoterapeuta",
  HR: "RH",
  ADMIN: "Suporte",
};

export function useSession() {
  const [state, setState] = useState<SessionState>(() => ({
    status: readUser() ? "loading" : "out",
    profile: null,
    notice: null,
  }));
  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [reloadUsers, setReloadUsers] = useState(0);

  const signIn = useCallback((id: string) => {
    rememberUser(id);
    return getMe().then(
      (me) => setState({ status: "in", profile: { ...me, roleLabel: ROLE_LABEL[me.role] }, notice: null }),
      (err: unknown) => {
        rememberUser(null);
        setState({ status: "out", profile: null, notice: errorMessage(err) });
      },
    );
  }, []);
  const signOut = useCallback(() => {
    rememberUser(null);
    setState({ status: "out", profile: null, notice: null });
  }, []);

  useEffect(() => {
    const id = readUser();
    if (id) signIn(id);
  }, [signIn]);

  useEffect(() => {
    if (state.status !== "out") return;
    let cancelled = false;
    getDemoUsers()
      .then((list) => {
        if (!cancelled) {
          setUsers(list);
          setUsersError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setUsersError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, reloadUsers]);

  return {
    ...state,
    users,
    usersError,
    signIn,
    signOut,
    retryUsers: () => {
      setUsersError(null);
      setReloadUsers((r) => r + 1);
    },
  };
}

export type Session = ReturnType<typeof useSession>;
