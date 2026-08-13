# How changes reach tessera.unitynodes.com

The site is served by the systemd unit `tessera-web`: `next start -p 3080`
from this directory. `next start` holds the built `.next` in the process
memory, so **a commit on its own changes nothing**, neither on the domain nor
after `npm run build` without a restart.

```bash
cd /root/tessera/web && npm run build && sudo systemctl restart tessera-web && sleep 5 && curl -s -o /dev/null https://tessera.unitynodes.com/
```

That last `curl` is not a check, it is the first visit. Game state lives in
the process cache, and after a restart the cache is empty: `gameNow()` returns
what it has (nothing) and only kicks off the read in the background. So it is
the first guest who gets markup without numbers and waits ten seconds while
their browser reads the chain instead. One request from the server itself
takes that queue.

To confirm the new build is the one running:

```bash
systemctl is-active tessera-web
curl -s https://tessera.unitynodes.com/ | grep -o '_next/static/chunks/[^"]*\.css'
```

## Small things that trip people up

- `npm run dev` takes port **3010** from `.env`. If it is busy the server does
  not come up at all; use `npx next dev --port <free>`.
- Files in `public/` are served from disk, so new images appear without a
  build. Code does not.

## Pushing to GitHub

```
./scripts/push.sh          # current branch
DRY=1 ./scripts/push.sh    # show what would go, and stop
```

A plain `git push` does not work here: the key GitHub accepts for
`UnityNodes/tessera` lives in `/root/.ssh/fearless` and is readable only by
root, while the repository itself belongs to `claude`. The script does three
things, any one of which is easy to forget: sudo, `safe.directory` (git under
root otherwise complains about "dubious ownership"), and `chown` back, because
git under root leaves root owned files in `.git` and it is the NEXT ordinary
command that fails, seemingly without cause.

The push is made as `0xFearless-1`. The other keys in `/root/.ssh` do not fit:
`github_deploy_key` is a deploy key for another repository, and GitHub rejects
the rest.
