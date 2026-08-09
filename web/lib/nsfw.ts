import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import { PNG } from "pngjs";

/**
 *
 *
 *
 *   Neutral 64.2%  Drawing 25.8%  Hentai 9.8%  Porn 0.2%  Sexy 0.0%
 *
 *
 *
 *
 */

const REJECT = {
  explicit: 0.5,
  hentai: 0.6,
};

export interface Verdict {
  ok: boolean;
  why?: string;
  scores: Record<string, number>;
}

let model: nsfwjs.NSFWJS | null = null;
let loading: Promise<nsfwjs.NSFWJS> | null = null;

async function load() {
  if (model) return model;
  if (!loading) loading = nsfwjs.load();
  model = await loading;
  return model;
}

export async function judge(png: Buffer): Promise<Verdict> {
  const img = PNG.sync.read(png);
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
