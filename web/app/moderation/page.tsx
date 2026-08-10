"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useReadContract, useSignMessage } from "wagmi";
import { EyeOff, Eye, ImageOff, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS } from "@/lib/chain";
import { useDeck } from "@/hooks/useDeck";
import { UpgradePanel } from "@/components/UpgradePanel";
import { bestTier } from "@/lib/deck";
import { Chest } from "@/components/Chest";

type Skin = { status: "pending" | "ok" | "no"; by: string; at: number; why?: string };

/**
 *
 *
 *
 *
 */
export default function ModerationPage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const game = useDeck();

  const { data: owner } = useReadContract({
    address: DECK_ADDRESS,
    abi: TESSERA_DECK_ABI,
    functionName: "owner",
  });

  const [hidden, setHidden] = useState<number[]>([]);
  const [skins, setSkins] = useState<Record<string, Skin>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/moderation");
    if (!r.ok) return;
    const j = (await r.json()) as { hidden: number[]; skins: Record<string, Skin> };
    setHidden(j.hidden);
    setSkins(j.skins);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = Boolean(
    address && owner && address.toLowerCase() === (owner as string).toLowerCase(),
  );

  const act = async (deckId: number, action: "hide" | "show" | "pull" | "restore") => {
    if (!address) return;
    setBusy(deckId);
    setError(null);
    try {
      const message = `tessera: ${action} deck ${deckId}`;
      const signature = await signMessageAsync({ message });
      const r = await fetch("/api/moderation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, action, deckId }),
      });
      const j = (await r.json()) as {
        hidden?: number[];
        skins?: Record<string, Skin>;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "refused");
      setHidden(j.hidden ?? []);
      setSkins(j.skins ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "refused");
    } finally {
      setBusy(null);
    }
  };

  if (!address || !owner) {
    return (
      <div className="w-full px-4 py-20 text-center text-slate-300">
        Connect the owner wallet to moderate.
      </div>
    );
  }
  if (!mine) {
    return <div className="w-full px-4 py-20 text-center text-slate-300">Nothing here.</div>;
  }

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
        <div className="border-b border-slate-800 pb-6">
          <h1 className="t-page text-white">Moderation</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-300">
            Hiding a deck removes its card from the catalog, the deck itself stays on chain and
            keeps working for whoever is already playing it. Pulling a picture removes the picture
            for good; the deck falls back to a plain chest.
          </p>
        </div>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <UpgradePanel owner={mine} />

        <h2 className="t-label mt-2">
          decks on chain · {game.decks.length}
        </h2>

        <div className="flex flex-col gap-3">
          {game.decks.map((d) => {
            const skin = skins[String(d.id)];
            const isHidden = hidden.includes(d.id);
            const best = bestTier(d);
            const name = d.cid ? d.cid.split(":")[0] : best?.name ?? `deck #${d.id}`;
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-slate-800 p-4"
                style={{ background: "var(--color-surface)" }}
              >
                <div className="flex min-w-0 items-center gap-4">
                  {skin?.status === "ok" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/skin/${d.id}`}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-[var(--radius-control)] object-contain"
                    />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[var(--radius-control)] border border-slate-800">
                      {best ? (
                        <Chest rarity={best.rarity} size={48} />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-400" />
                      )}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white">
                      {name}{" "}
                      <span className="t-chain text-sm text-[var(--color-ink-dim)]">#{d.id}</span>
                    </p>
                    <p className="t-chain text-sm text-slate-400">
                      {d.size} slots · {d.remaining} left
                      {d.empty ? " · empty" : ""}
                      {d.vaultUpTo > 0 ? " · has a vault" : ""}
                      {isHidden ? " · hidden from the catalog" : ""}
                      {skin ? ` · picture ${skin.status}` : ""}
                    </p>
                    <p className="t-addr truncate text-sm text-slate-500">
                      {d.creator ? `cut by ${d.creator} · takes ${d.creatorBps / 100}%` : "house deck"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {skin && skin.status !== "no" && (
                    <Button
                      size="sm"
                      variant="quiet"
                      disabled={busy === d.id}
                      onClick={() => void act(d.id, "pull")}
                    >
                      <ImageOff className="h-4 w-4" />
                      Pull picture
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={busy === d.id}
                    onClick={() => void act(d.id, isHidden ? "show" : "hide")}
                  >
                    {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {isHidden ? "Show" : "Hide"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
