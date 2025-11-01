import express from "express";

export function createServer() {
  const app = express();

  app.get("/", (_req, res) => {
    res.type("text").send("Backend OK. Essayez /health");
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  return app;
}
