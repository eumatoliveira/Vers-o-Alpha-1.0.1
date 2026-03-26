import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type LogoutOptions = {
  redirectTo?: string;
};

function isLogoutOptions(value: unknown): value is LogoutOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "redirectTo" in value
  );
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } =
    options ?? {};
  const [, setLocation] = useLocation();
  // Lazy-evaluate getLoginUrl() only when actually needed to avoid
  // TypeError when VITE_OAUTH_PORTAL_URL is not configured.
  const resolvedRedirectPath = redirectPath ?? (redirectOnUnauthenticated ? getLoginUrl() : "/login");
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: 0,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async (logoutArg?: unknown) => {
    const redirectTo = isLogoutOptions(logoutArg) ? logoutArg.redirectTo : undefined;
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }

    if (!redirectTo || typeof window === "undefined") return;

    const isExternal = /^https?:\/\//i.test(redirectTo);
    if (isExternal) {
      window.location.assign(redirectTo);
      return;
    }

    if (window.location.pathname !== redirectTo) {
      setLocation(redirectTo);
    }
  }, [logoutMutation, setLocation, utils]);

  const state = useMemo(() => {
    try {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
    } catch {
      // Ignore storage failures (private mode / disabled storage).
    }
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === resolvedRedirectPath) return;

    const isExternal = /^https?:\/\//i.test(resolvedRedirectPath);
    if (isExternal) {
      window.location.assign(resolvedRedirectPath);
      return;
    }

    setLocation(resolvedRedirectPath);
  }, [
    redirectOnUnauthenticated,
    resolvedRedirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    setLocation,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
