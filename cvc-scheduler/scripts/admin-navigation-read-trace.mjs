// Local production-mode measurement only. Never imported by the application.
import { AsyncLocalStorage } from "node:async_hooks";
import { Server } from "node:http";

const requestScope = new AsyncLocalStorage();
let sequence = 0;
const originalEmit = Server.prototype.emit;
Server.prototype.emit = function (event, ...args) {
  if (event !== "request") return originalEmit.call(this, event, ...args);
  const [request, response] = args;
  const scope = { requestId: ++sequence, path: new URL(request.url, "http://localhost").pathname, prefetch: Boolean(request.headers["next-router-prefetch"] || request.headers["next-router-segment-prefetch"]), action: Boolean(request.headers["next-action"]) };
  const started = performance.now();
  response.once("finish", () => console.log(JSON.stringify({ measurement: "admin-request", ...scope, startedMs: Math.round(started), durationMs: Math.round(performance.now() - started) })));
  return requestScope.run(scope, () => originalEmit.call(this, event, ...args));
};
const latency = Number(process.env.ADMIN_NAVIGATION_READ_LATENCY_MS ?? 0);
if (!Number.isFinite(latency) || latency < 0 || latency > 1000) throw new Error("Invalid local read latency.");
const originalFetch = globalThis.fetch;
let stalled = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const tracked = url.pathname.startsWith("/auth/v1/") || url.pathname.startsWith("/rest/v1/");
  if (!tracked) return originalFetch(input, init);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Navigation measurement accepts only loopback Supabase.");
  }
  if (!stalled && process.env.ADMIN_NAVIGATION_STALL_ONCE_TARGET === url.pathname) {
    stalled = true;
    console.log(JSON.stringify({measurement:"admin-stalled-read",...requestScope.getStore(),target:url.pathname}));
    return new Promise(() => {});
  }
  const started = performance.now();
  if (latency) await new Promise(resolve => setTimeout(resolve, latency));
  try {
    return await originalFetch(input, init);
  } finally {
    console.log(JSON.stringify({ measurement: "admin-read", ...requestScope.getStore(), target: url.pathname, startedMs: Math.round(started), durationMs: Math.round(performance.now() - started), latencyMs: latency }));
  }
};
