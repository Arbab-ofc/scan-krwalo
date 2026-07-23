import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { env } from "./env.js";
import { expireDueTasks } from "./services/tasks.service.js";

const app = await buildApp();
attachRealtime(app);

if (env.RUN_WORKER_IN_API) {
  await import("./worker.js");
  app.log.info("Background workers started in API process");
}

const expirySweep = setInterval(() => {
  expireDueTasks().catch((error) => app.log.error({ error }, "Task expiry sweep failed"));
}, 30_000);
expirySweep.unref();
expireDueTasks().catch((error) => app.log.error({ error }, "Initial task expiry sweep failed"));

await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
