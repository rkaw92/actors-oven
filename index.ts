import { Type, type Static } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'

const ClientMessage = Type.Object({
  name: Type.String(),
});
const ClientMessageC = TypeCompiler.Compile(ClientMessage);

function handleNameMessage(input: Static<typeof ClientMessage>) {
  console.log('Hey %s', input.name);
}

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response('Upgrade failed', { status: 500 });
  },
  websocket: {
    message(ws, message) {
      if (typeof message !== 'string') {
        return;
      }
      try {
        const payload = JSON.parse(message);
        if (ClientMessageC.Check(payload)) {
          handleNameMessage(payload);
        }
      } catch (err) {
        // We are the server and we have no chill
        ws.close();
      }
    }
  }
});

console.log(`Listening on http://localhost:${server.port} ...`);
