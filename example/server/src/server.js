import Fastify from "fastify";

const PORT = Number(process.env.PORT ?? 4321);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: { level: "info" } });

// Simple in-memory todo store. Resets every restart on purpose so the demo
// always starts from a known state.
let nextId = 3;
let todos = [
  { id: 1, title: "Try Boson", done: false },
  { id: 2, title: "Send a request", done: false },
];

app.get("/health", async () => ({
  status: "ok",
  service: "boson-example-server",
  uptime_ms: Math.round(process.uptime() * 1000),
}));

app.get("/todos", async (request) => {
  const done = request.query?.done;
  if (done === "true") return todos.filter((t) => t.done);
  if (done === "false") return todos.filter((t) => !t.done);
  return todos;
});

app.get("/todos/:id", async (request, reply) => {
  const id = Number(request.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return reply.code(404).send({ error: "not found" });
  return todo;
});

app.post("/todos", async (request, reply) => {
  const body = request.body ?? {};
  if (!body.title || typeof body.title !== "string") {
    return reply.code(400).send({ error: "title (string) is required" });
  }
  const created = { id: nextId++, title: body.title, done: Boolean(body.done) };
  todos.push(created);
  return reply.code(201).send(created);
});

app.patch("/todos/:id", async (request, reply) => {
  const id = Number(request.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return reply.code(404).send({ error: "not found" });
  Object.assign(todo, request.body ?? {});
  return todo;
});

app.delete("/todos/:id", async (request, reply) => {
  const id = Number(request.params.id);
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return reply.code(404).send({ error: "not found" });
  todos.splice(idx, 1);
  return reply.code(204).send();
});

// Echo endpoint exercises body / headers / auth flows in Boson.
app.post("/echo", async (request) => ({
  ok: true,
  method: request.method,
  url: request.url,
  headers: request.headers,
  query: request.query,
  body: request.body,
}));

// Bearer-token-protected endpoint to exercise Boson's auth + secrets.
app.get("/secure", async (request, reply) => {
  const auth = request.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "missing bearer token" });
  }
  const token = auth.slice("Bearer ".length).trim();
  if (token !== (process.env.DEMO_TOKEN ?? "boson-demo-token")) {
    return reply.code(403).send({ error: "invalid bearer token" });
  }
  return { ok: true, you_are: "authenticated" };
});

app.listen({ port: PORT, host: HOST }).then((address) => {
  app.log.info(`example API ready at ${address}`);
});
