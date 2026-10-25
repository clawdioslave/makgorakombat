# makgora-relay

The wire between two players of MAK'GORA KOMBAT online. It is a Cloudflare Worker with one
Durable Object per room; a room is a six-letter code of consonants (no vowels, no L or Y), holds
at most one host and one guest, and passes every message one of them sends to the other exactly
as it came, text or bytes. It reads none of it and keeps none of it: both machines run the fight
themselves in lockstep, each from its own World of Warcraft folder, and the relay only carries
their inputs between them. A room nobody has been in for ten minutes is forgotten.

## The protocol

- `POST /rooms` makes a room and answers `{"code":"HXBXDC"}`.
- `GET /rooms/:code/ws?role=host|guest` upgrades to a WebSocket. A code nobody made is 404, a
  second host or guest is 409.
- When the other player is in the room (on joining, or when they arrive) the relay sends
  `{"t":"peer","joined":true}`; when they leave, `{"t":"peer","joined":false}`.
- `ping` is answered `pong` by the room itself without waking it: a keep-alive, and a way to
  time the wire.
- Every other message goes to the other player unchanged.

Pages on `https://realworldbuilder.github.io` and `http://localhost:*` (or `127.0.0.1`) may use
it; other sites are refused. Node and other clients that send no `Origin` are let in.

## Your own relay

The game uses Chris's deploy, `https://makgora-relay.clawdgross.workers.dev`, unless SETTINGS
on the title names another (NETWORK, remembered in the browser as `makgora.relay`). To run your
own on your Cloudflare account (the free plan is enough):

```sh
cd relay
pnpm install
pnpm exec wrangler login
pnpm run deploy
```

It needs no secrets, no storage of its own and no custom domain; wrangler prints the
`https://makgora-relay.<your-subdomain>.workers.dev` address to put in SETTINGS. Both players
must use the same relay.

## Working on it

- `pnpm test` runs the room's tests inside the Workers runtime (`@cloudflare/vitest-plugin`).
- `pnpm build` type-checks it.
- `pnpm dev` serves it on `http://localhost:8787`.
- `node scripts/probe.mjs [url] [rounds]` makes a room on a deployed relay, joins it twice and
  prints how long a ping to the room and an echo through it take.
