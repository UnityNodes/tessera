import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import { PNG } from "pngjs";

/**
 * An automatic filter for the pictures deck creators upload.
 *
 * The model classifies an image into five classes and returns probabilities:
 * Neutral, Drawing, Sexy, Hentai, Porn. The decision is below, and its
 * thresholds are tuned for what will REALLY be brought here.
 *
 * Measured on the kungfumode artwork, a drawn chibi character:
 *
 *   Neutral 64.2%  Drawing 25.8%  Hentai 9.8%  Porn 0.2%  Sexy 0.0%
 *
 * Almost ten percent of "Hentai" on a perfectly innocent drawing is not an error
 * but a known property of the model: any anime styling pulls that class up. And
 * that is exactly the art that will dominate here. So the threshold for Hentai
 * is high and the real decision is made by Porn and Sexy.
 *
 * ── What this filter does NOT do ───────────────────────────────────────
 *
 * It gives no guarantee. The model errs in both directions, and all that has
 * been checked here is that it LETS THROUGH a normal drawing. Whether it catches
 * forbidden material I have not tested and will not: doing so would mean
 * obtaining such material from somewhere.
 *
 * So the picture lives off chain and is taken down with one command. That is the
 * real safeguard; the model only reduces how much has to be reached for by hand.
 */

const REJECT = {
  /** Pornography and explicit erotica, the main decision. */
  explicit: 0.5,
  /** Anime styling pulls this class up even on a children's drawing. */
  hentai: 0.6,
};

export interface Verdict {
  ok: boolean;
  why?: string;
  scores: Record<string, number>;
}

let model: nsfwjs.NSFWJS | null = null;
let loading: Promise<nsfwjs.NSFWJS> | null = null;

/** The model weighs a few hundred megabytes in memory, so it loads once. */
async function load() {
  if (model) return model;
  if (!loading) loading = nsfwjs.load();
  model = await loading;
  return model;
}

export async function judge(png: Buffer): Promise<Verdict> {
  const img = PNG.sync.read(png);
  // The model expects three channels and a PNG arrives with a fourth. A
  // transparent pixel then becomes black, and that is right: what cannot be
  // seen should not affect the decision.
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    rgb[j] = img.data[i];
    rgb[j + 1] = img.data[i + 1];
    rgb[j + 2] = img.data[i + 2];
  }

  const net = await load();
  const tensor = tf.tensor3d(rgb, [img.height, img.width, 3], "int32");
  try {
    const out = await net.classify(tensor);
    const scores: Record<string, number> = {};
    for (const r of out) scores[r.className] = r.probability;

    const explicit = (scores.Porn ?? 0) + (scores.Sexy ?? 0);
    if (explicit > REJECT.explicit) {
      return { ok: false, why: "explicit content", scores };
    }
    if ((scores.Hentai ?? 0) > REJECT.hentai) {
      return { ok: false, why: "explicit content", scores };
    }
    return { ok: true, scores };
  } finally {
    tensor.dispose();
  }
}
