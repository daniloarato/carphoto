import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createApp().listen(port, host, () => {
  console.log(`CarPhoto running on ${host}:${port}`);
});
server.requestTimeout = 240_000;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
