# tessera.unitynodes.com

systemd-`tessera-web`: `next start -p 3080`
. `next start` `.next` ',
`npm run build` .

```bash
cd /root/tessera/web && npm run build && sudo systemctl restart tessera-web
```

, :

```bash
systemctl is-active tessera-web
curl -s https://tessera.unitynodes.com/ | grep -o '_next/static/chunks/[^"]*\.css'
```

## ,

- `npm run dev` **3010** `.env`. ,
  `npx next dev --port <>`.
- `public/` ,
  . .

## GitHub

```
./scripts/push.sh          #
DRY=1 ./scripts/push.sh    # ,
```

`git push` : , GitHub
`UnityNodes/tessera`, `/root/.ssh/fearless`
root, `claude`. ,
: sudo, `safe.directory` (git root
dubious ownership) `chown` git root
`.git`, ,
.

`0xFearless-1`. `/root/.ssh` :
`github_deploy_key` deploy-custis, GitHub
.
