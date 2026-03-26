import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import * as db from "./db";

const aiProviderSchema = z.enum(["anthropic", "openai"]);

const providerBaseUrl: Record<z.infer<typeof aiProviderSchema>, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
};

const providerEnvToken: Record<z.infer<typeof aiProviderSchema>, string> = {
  anthropic: ENV.claudeApiKey,
  openai: ENV.openAiApiKey,
};

export const aiCredentialsRouter = router({
  get: protectedProcedure
    .input(z.object({ provider: aiProviderSchema }))
    .query(async ({ ctx, input }) => {
      const config = await db.getProviderIntegrationConfig(ctx.user.id, input.provider);
      const fallbackToken = providerEnvToken[input.provider] ?? "";
      const accessToken = fallbackToken || config?.accessToken?.trim() || "";
      return {
        provider: input.provider,
        accessToken,
        hasAccessToken: Boolean(accessToken),
        updatedAt: config?.updatedAt ?? null,
      };
    }),

  save: protectedProcedure
    .input(
      z.object({
        provider: aiProviderSchema,
        accessToken: z.string().trim().max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasAccessToken = input.accessToken.length > 0;
      const saved = await db.upsertProviderIntegrationConfig({
        userId: ctx.user.id,
        provider: input.provider,
        enabled: hasAccessToken,
        accessToken: input.accessToken,
        apiBaseUrl: providerBaseUrl[input.provider],
        metadata: {
          category: "ai_credentials",
        },
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "SAVE_AI_CREDENTIAL",
        entity: "integrations",
        entityId: `${ctx.user.id}:${input.provider}`,
        newValue: {
          provider: input.provider,
          hasAccessToken,
        },
      });

      return {
        success: true,
        provider: input.provider,
        hasAccessToken,
        updatedAt: saved.updatedAt ?? null,
      };
    }),
});
