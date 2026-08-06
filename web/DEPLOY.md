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
