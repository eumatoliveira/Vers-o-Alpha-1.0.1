let appPromise: Promise<(req: any, res: any) => any> | null = null;

async function getApp() {
  if (!appPromise) {
    process.env.NODE_ENV = process.env.NODE_ENV || "production";
    // @ts-ignore - vercel-app.js is generated during build
    appPromise = import("../dist/vercel-app.js").then((mod) => mod.createHttpApp());
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected API bootstrap failure";

    console.error("[api/index] Serverless handler failed:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "internal_server_error",
          message,
        })
      );
      return;
    }

    throw error;
  }
}
