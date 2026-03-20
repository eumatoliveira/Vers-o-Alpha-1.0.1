import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { adminRouter } from "./adminRouter";
import { authRouter } from "./authRouter";
import { dashboardDataRouter } from "./dashboardDataRouter";
import { controlTowerRouter } from "./controlTowerRouter";
import { currencyRouter } from "./currencyRouter";
import { apiKeyRouter } from "./apiKeyRouter";
import { aiChatRouter } from "./aiChatRouter";
import { getClientBySlug, getAllDashboardData, getManualEntries, createManualEntry, deleteManualEntry } from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;

      return {
        id: user.id,
        openId: user.openId,
        email: user.email,
        name: user.name,
        loginMethod: user.loginMethod,
        role: user.role,
        plan: user.plan,
        preferredCurrency: user.preferredCurrency,
        mfaEnabled: user.mfaEnabled,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Email/Password Authentication Routes
  emailAuth: authRouter,

  // Admin Dashboard Routes
  admin: adminRouter,

  // Dashboard Data Management Routes
  dashboardData: dashboardDataRouter,

  // Control Tower Enterprise BI (Client Dashboard /dashboard)
  controlTower: controlTowerRouter,
  currency: currencyRouter,
  apiKeys: apiKeyRouter,

  // GLX Insights — Multi-Tenant AI Chat
  aiChat: aiChatRouter,

  // Manual Entries CRUD (for authenticated clients)
  manualEntries: router({
    list: protectedProcedure
      .input(z.object({ category: z.enum(["financial", "attendance"]).optional() }))
      .query(async ({ ctx, input }) => {
        return await getManualEntries(ctx.user!.id, input.category);
      }),
    create: protectedProcedure
      .input(z.object({
        category: z.enum(["financial", "attendance"]),
        entryType: z.string().min(1),
        label: z.string().min(1),
        value: z.string().optional(),
        detail: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createManualEntry({
          userId: ctx.user!.id,
          category: input.category,
          entryType: input.entryType,
          label: input.label,
          value: input.value,
          detail: input.detail,
        });
        return { success: true, id };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteManualEntry(input.id, ctx.user!.id);
      }),
  }),

  // Client Dashboard Data (for authenticated clients)
  clientDashboard: router({
    getMyDashboard: protectedProcedure
      .input(z.object({ clientSlug: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Client dashboard access by slug is restricted",
          });
        }
        const client = await getClientBySlug(input.clientSlug);
        if (!client) {
          return null;
        }
        return await getAllDashboardData(client.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
