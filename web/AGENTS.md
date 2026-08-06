<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes, APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

#

. . [DEPLOY.md](./DEPLOY.md):
`npm run build` `sudo systemctl restart tessera-web`.

#

- `scripts/browser-e2e.cjs`
  : ', , , .
  `DEPLOYER_PRIVATE_KEY`. `OPENS=n` ,
  ; `WATCH=1` .
- , , `app/api/opens`:
  . ,
  , 429 RPC .

#

`scripts/audit.sh` : , → , →
, , . `OPENS=3 ./audit.sh`
().

audit-chain: ,
. , , ,
-.
