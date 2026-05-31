import app from "./app";
import { logger } from "./lib/logger";
import { startWebSocketServer } from "./lib/ws";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const wsPort = port + 1;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start WebSocket server on adjacent port
  try {
    startWebSocketServer(wsPort);
  } catch (err) {
    logger.error({ err, wsPort }, "WebSocket server failed to start");
  }
});
