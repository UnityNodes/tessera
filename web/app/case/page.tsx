"use client";

import { DeckShelf } from "@/components/DeckShelf";

/**
 *
 */
export default function CasesPage() {
  return (
    <>
      <div className="mb-2">
        <h1 className="t-inscription text-xl">the cases</h1>
        <p className="t-label mt-2">
          each deck shuffled once, before anyone opened one · $1 a case
        </p>
      </div>
      <div className="mt-8">
        <DeckShelf />
      </div>
    </>
  );
}
