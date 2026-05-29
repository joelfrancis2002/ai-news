import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.API_PORT ?? 4000);

  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`API listening on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err, "startup_failure");
    process.exit(1);
  }
}

void main();

