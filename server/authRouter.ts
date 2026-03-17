import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { 
  getUserByEmail, 
  createUserWithPassword, 
  updateUserPassword, 
  updateUserLastSignIn,
  getAllUsers,
  updateUser,
  updateUserPlan,
  deleteUser,
  updateUserStatus,
  createAuditLog,
  provisionUserIntegrations,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";

const TEST_CLIENTS = ENV.bootstrapTestClientEmails.map((email) => ({
  email,
  password: ENV.bootstrapTestClientPassword,
  plan: "essencial" as const,
  name: ENV.bootstrapTestClientName,
}));

const BOOTSTRAP_DEMO_CLIENTS = (() => {
  const byEmail = new Map<
    string,
    { email: string; password: string; plan: "essencial" | "pro" | "enterprise"; name: string }
  >();

  for (const user of TEST_CLIENTS) {
    if (!user.email || !user.password) continue;
    byEmail.set(user.email, user);
  }

  for (const user of ENV.bootstrapDemoUsers) {
    byEmail.set(user.email, user);
  }

  return Array.from(byEmail.values());
})();

const adminProvisionedIntegrationTypeValues = [
  "kommo",
  "asaas",
  "crm_hubspot",
  "crm_rd_station",
  "meta_pixel",
  "meta_capi",
  "google_ads",
  "google_ads_enhanced",
  "gtm",
  "server_side_gtm",
  "google_sheets",
  "power_bi",
] as const;

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().min(1).max(max).optional(),
  );

const optionalTrimmedUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().url().max(2000).optional(),
);

const adminProvisionedIntegrationSchema = z.object({
  type: z.enum(adminProvisionedIntegrationTypeValues),
  name: optionalTrimmedString(255),
  token: optionalTrimmedString(2000),
  apiUrl: optionalTrimmedUrl,
  identifier: optionalTrimmedString(500),
});

// Initialize admin user on first load
async function initializeAdminUser() {
  if (!ENV.isDevelopment) {
    return;
  }

  if (!ENV.bootstrapAdminEmail || !ENV.bootstrapAdminPassword) {
    console.warn("[Auth] Admin bootstrap skipped. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env.");
    return;
  }

  const existingAdmin = await getUserByEmail(ENV.bootstrapAdminEmail);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ENV.bootstrapAdminPassword, 12);
    await createUserWithPassword({
      email: ENV.bootstrapAdminEmail,
      passwordHash,
      name: "GLX Admin",
      role: "admin",
    });
    console.log("[Auth] Admin bootstrap user created.");
  }
}

// Ensure configured test users exist when bootstrap variables are set.
async function ensureTestClientUsers() {
  if (!ENV.isDevelopment) {
    return;
  }

  if (BOOTSTRAP_DEMO_CLIENTS.length === 0) {
    console.warn(
      "[Auth] Test user bootstrap skipped. Configure BOOTSTRAP_DEMO_USERS or BOOTSTRAP_TEST_CLIENT_EMAILS/BOOTSTRAP_TEST_CLIENT_PASSWORD in .env."
    );
    return;
  }

  const passwordHashCache = new Map<string, string>();

  for (const testClient of BOOTSTRAP_DEMO_CLIENTS) {
    let passwordHash = passwordHashCache.get(testClient.password);
    if (!passwordHash) {
      passwordHash = await bcrypt.hash(testClient.password, 12);
      passwordHashCache.set(testClient.password, passwordHash);
    }

    const existingClient = await getUserByEmail(testClient.email);

    if (!existingClient) {
      const user = await createUserWithPassword({
        email: testClient.email,
        passwordHash,
        name: testClient.name,
        role: "user",
      });
      if (user) {
        await updateUserPlan(user.id, testClient.plan);
        await updateUserStatus(user.id, true);
      }
      console.log(`[Auth] Test user bootstrap created: ${testClient.email} (${testClient.plan})`);
      continue;
    }

    await Promise.all([
      updateUserPassword(existingClient.id, passwordHash),
      updateUserStatus(existingClient.id, true),
      updateUserPlan(existingClient.id, testClient.plan),
      existingClient.name ? Promise.resolve() : updateUser(existingClient.id, { name: testClient.name }),
    ]);

    console.log(`[Auth] Test user bootstrap ensured: ${testClient.email} (${testClient.plan})`);
  }
}

// Call initialization
initializeAdminUser().catch(console.error);
ensureTestClientUsers().catch(console.error);

export const authRouter = router({
  // Login with email/password
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await getUserByEmail(normalizedEmail);
      
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email ou senha inválidos",
        });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Este usuário não possui senha configurada. Use outro método de login.",
        });
      }

      if (!user.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conta desativada. Entre em contato com o administrador.",
        });
      }

      const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
      
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email ou senha inválidos",
        });
      }

      // Update last sign in
      await updateUserLastSignIn(user.id);

      // Create JWT token
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({
        sub: user.openId,
        email: user.email,
        role: user.role,
        name: user.name,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Create audit log
      await createAuditLog({
        userId: user.id,
        action: "login",
        entity: "user",
        entityId: user.id.toString(),
        ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString(),
        userAgent: ctx.req.headers["user-agent"],
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  // Register new user (admin only or self-registration if enabled)
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const existingUser = await getUserByEmail(normalizedEmail);
      
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este email já está cadastrado",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      
      const user = await createUserWithPassword({
        email: normalizedEmail,
        passwordHash,
        name: input.name,
        role: "user",
      });

      return {
        success: true,
        message: "Usuário criado com sucesso",
      };
    }),
  recoverPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await getUserByEmail(normalizedEmail);

      // Retorna sucesso mesmo se o usuário não existir para evitar enumeração de contas.
      if (!user || !user.passwordHash || !user.isActive) {
        return {
          success: true,
          message: "Se o e-mail estiver cadastrado, a senha foi atualizada.",
        };
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(user.id, newPasswordHash);

      await createAuditLog({
        userId: user.id,
        action: "recover_password",
        entity: "user",
        entityId: user.id.toString(),
      });

      return {
        success: true,
        message: "Se o e-mail estiver cadastrado, a senha foi atualizada.",
      };
    }),
  // Change password (authenticated user)
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(ctx.user.email || "");
      
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Usuário não encontrado ou sem senha configurada",
        });
      }

      const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
      
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Senha atual incorreta",
        });
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(user.id, newPasswordHash);

      await createAuditLog({
        userId: user.id,
        action: "change_password",
        entity: "user",
        entityId: user.id.toString(),
      });

      return { success: true, message: "Senha alterada com sucesso" };
    }),
  // Admin: Create user
  createUser: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      role: z.enum(["user", "admin"]).default("user"),
      plan: z.enum(["essencial", "pro", "enterprise"]).default("essencial"),
      integrations: z.array(adminProvisionedIntegrationSchema).max(20).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const allowClientStartWithoutCrm = true;

      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem criar usuários",
        });
      }

      const normalizedEmail = input.email.trim().toLowerCase();
      const existingUser = await getUserByEmail(normalizedEmail);
      
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este email já está cadastrado",
        });
      }

      const normalizedIntegrations =
        input.integrations?.filter((item) => item.token || item.apiUrl || item.identifier) ?? [];

      if (!allowClientStartWithoutCrm && input.role === "user" && normalizedIntegrations.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe pelo menos uma integração (API/TOKEN/ID) para iniciar o dashboard do cliente",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      
      const user = await createUserWithPassword({
        email: normalizedEmail,
        passwordHash,
        name: input.name,
        role: input.role,
      });

      if (user && input.plan && input.plan !== "essencial") {
        await updateUserPlan(user.id, input.plan);
      }

      let integrationProvisioningWarning: string | null = null;
      let integrationCount = 0;

      if (user && normalizedIntegrations.length > 0) {
        try {
          const provisionResult = await provisionUserIntegrations({
            userId: user.id,
            clientName: input.name?.trim() || normalizedEmail.split("@")[0] || `Cliente ${user.id}`,
            items: normalizedIntegrations.map((integration) => ({
              type: integration.type,
              name: integration.name?.trim() || undefined,
              token: integration.token,
              apiUrl: integration.apiUrl,
              identifier: integration.identifier,
              metadata: {
                provisionedByAdminId: ctx.user.id,
                provisionedAt: new Date().toISOString(),
              },
            })),
          });
          integrationCount = provisionResult.createdCount;
        } catch (error) {
          integrationProvisioningWarning =
            error instanceof Error ? error.message : "Falha ao provisionar integrações do cliente";
          console.error("[Auth] User created but integration provisioning failed:", error);
        }
      }

      await createAuditLog({
        userId: ctx.user.id,
        action: "create_user",
        entity: "user",
        entityId: user?.id.toString(),
        newValue: {
          email: normalizedEmail,
          role: input.role,
          plan: input.plan,
          integrationCount,
          integrationTypes: normalizedIntegrations.map((item) => item.type),
          integrationProvisioningWarning,
        },
      });

      return {
        success: true,
        message: integrationProvisioningWarning
          ? "Usuário criado, mas houve falha ao salvar integrações"
          : "Usuário criado com sucesso",
        integrationCount,
        integrationProvisioningWarning,
      };
    }),
  // Admin: Update user
  updateUser: protectedProcedure
    .input(z.object({
      userId: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(["user", "admin"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem editar usuários",
        });
      }

      const { userId, ...updates } = input;
      await updateUser(userId, updates);

      await createAuditLog({
        userId: ctx.user.id,
        action: "update_user",
        entity: "user",
        entityId: userId.toString(),
        newValue: updates,
      });

      return { success: true, message: "Usuário atualizado com sucesso" };
    }),
  // Admin: Delete user
  deleteUser: protectedProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem excluir usuários",
        });
      }

      // Prevent deleting self
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode excluir sua própria conta",
        });
      }

      await deleteUser(input.userId);

      await createAuditLog({
        userId: ctx.user.id,
        action: "delete_user",
        entity: "user",
        entityId: input.userId.toString(),
      });

      return { success: true, message: "Usuário excluído com sucesso" };
    }),
  // Admin: Reset user password
  resetPassword: protectedProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem resetar senhas",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(input.userId, passwordHash);

      await createAuditLog({
        userId: ctx.user.id,
        action: "reset_password",
        entity: "user",
        entityId: input.userId.toString(),
      });

      return { success: true, message: "Senha resetada com sucesso" };
    }),
  // Admin: Toggle user status
  toggleUserStatus: protectedProcedure
    .input(z.object({
      userId: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem alterar status de usuários",
        });
      }

      await updateUserStatus(input.userId, input.isActive);

      await createAuditLog({
        userId: ctx.user.id,
        action: input.isActive ? "activate_user" : "deactivate_user",
        entity: "user",
        entityId: input.userId.toString(),
      });

      return { success: true, message: `Usuário ${input.isActive ? "ativado" : "desativado"} com sucesso` };
    }),

  // Get all users (admin only)
  getAllUsers: protectedProcedure
    .input(z.object({
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem listar usuários",
        });
      }

      const users = await getAllUsers(input?.limit || 100, input?.offset || 0);
      return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        plan: (u as any).plan ?? 'essencial',
        isActive: u.isActive,
        mfaEnabled: u.mfaEnabled,
        loginMethod: u.loginMethod,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),
});
