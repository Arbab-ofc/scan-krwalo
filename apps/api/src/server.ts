import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { env } from "./env.js";

const app = await buildApp();
attachRealtime(app);

if (env.RUN_WORKER_IN_API) {
  await import("./worker.js");
  app.log.info("Background workers started in API process");
}

await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
