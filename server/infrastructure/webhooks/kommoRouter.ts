import { Router } from "express";
import { createHash } from "node:crypto";
import { processKommoWebhookUseCase } from "../../application/useCases/processKommoWebhookUseCase";
import { findProviderConfigByWebhookToken } from "../../db";
import { normalizeKommoPayload } from "../../domain/integrationEventNormalizer";
import { enqueueIntegrationEvent } from "../../domain/integrationQueue";
import { ENV } from "../../_core/env";

function resolveWebhookEventId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return `kommo-${Date.now()}`;
  const record = payload as Record<string, unknown>;
  const direct = record.event_id ?? record.id;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "number") return String(direct);

  const leads = record.leads;
  if (Array.isArray(leads) && leads.length > 0) {
    const first = leads[0];
    if (first && typeof first === "object") {
      const leadId = (first as Record<string, unknown>).id;
      if (typeof leadId === "string" || typeof leadId === "number") {
        return `lead-${leadId}`;
      }
    }
  }

  return `kommo-${Date.now()}`;
}

export const kommoWebhookRouter = Router();

kommoWebhookRouter.post("/webhook", async (req, res) => {
  try {
    const signature = req.header("x-signature") ?? req.header("x-kommo-signature") ?? undefined;
    const eventId = resolveWebhookEventId(req.body);
    const config = await findProviderConfigByWebhookToken("kommo", signature ?? ENV.kommoWebhookSecret);
    const result = await processKommoWebhookUseCase({
      eventId,
      signature,
      payload: req.body,
      expectedSecret: config?.webhookSecret ?? ENV.kommoWebhookSecret,
    });

    if (result.accepted && config) {
      const envelopes = normalizeKommoPayload(req.body, req.header("content-type") ?? undefined, signature);
      for (const envelope of envelopes) {
        await enqueueIntegrationEvent({
          userId: config.userId,
          provider: "kommo",
          envelope,
        });
      }
    }

    res.status(result.accepted ? 200 : 401).json({
      ok: result.accepted,
      status: result.status,
      eventId,
      reason: result.reason,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: "failed",
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
});

kommoWebhookRouter.get("/webhook/revoked", async (req, res) => {
  try {
    const queryIndex = req.originalUrl.indexOf("?");
    const rawQuery = queryIndex >= 0 ? req.originalUrl.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(rawQuery);
    const signature = params.get("sign") ?? "";

    if (!ENV.kommoClientSecret) {
      return res.status(401).json({ ok: false, reason: "missing_client_secret" });
    }

    if (!signature) {
      return res.status(401).json({ ok: false, reason: "missing_signature" });
    }

    params.delete("sign");
    const baseString = params.toString();
    // codeql[js/weak-cryptographic-algorithm] — SHA-1 is mandated by the Kommo webhook spec; cannot be changed
    const expectedSignature = createHash("sha1")
      .update(`${baseString}${ENV.kommoClientSecret}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(401).json({ ok: false, reason: "invalid_signature" });
    }

    return res.status(200).json({
      ok: true,
      accountId: req.query.account_id ?? null,
      clientId: req.query.client_id ?? null,
      from: req.query.from ?? null,
      revokedAt: req.query.date_create ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }
});

export function registerKommoWebhookRouter(app: Router) {
  app.use("/crm/kommo", kommoWebhookRouter);
}
