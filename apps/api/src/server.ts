import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";

const app = await buildApp();
attachRealtime(app);
await app.listen({ port: 4000, host: "0.0.0.0" });
