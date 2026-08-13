<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.
<!-- END:nextjs-agent-rules -->

# Deploying

A commit does not update the site. See [DEPLOY.md](./DEPLOY.md): it takes
`npm run build` and `sudo systemctl restart tessera-web`.

# Checking

- `scripts/browser-e2e.cjs` is an end to end run in a real browser with an
  injected wallet: connect, mint, open, prize. It takes the key from
  `DEPLOYER_PRIVATE_KEY`. `OPENS=n` opens repeatedly until a prize lands;
  `WATCH=1` records the strip while it waits.
- The chain reads shared by every visitor live in `app/api/opens`: the event
  history and the revealed slot values. Every browser that does this for
  itself runs into the public RPC's 429, which is exactly what used to happen.

# Auditing

`scripts/audit.sh` runs everything: contracts, chain to server, server to
screen, load, knowledge base. `OPENS=3 ./audit.sh` adds a real open, which
spends slots out of a deck.

The important thing about audit-chain: it does NOT import the site's code, it
reads the chain with its own client. A check assembled from the very code it
checks would pass on any mistake that code makes.
