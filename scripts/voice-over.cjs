//
//
//

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const KEY = process.env.ELEVEN_API_KEY;
const SRC = process.argv[2] ?? "/tmp/tessera-demo2/tessera-demo.mp4";
const OUT = process.env.OUT ?? "/tmp/tessera-demo2/tessera-demo-voiced.mp4";
const WORK = "/tmp/tessera-vo";
const VOICE = process.env.ELEVEN_VOICE_ID ?? "";
const MODEL = process.env.ELEVEN_MODEL ?? "eleven_multilingual_v2";

/**
 *
 */
const LINES = [
  { at: 1.5, text: "Tessera is a case opening game on Base, where the odds are a fact you can recount, not a claim we make." },
  { at: 10, text: "Every deck is an encrypted list, shuffled on chain by Inco. Nobody can see what is inside. Not the players, and not us." },
  { at: 20, text: "A deck is finite. Cards come out in order, without replacement, and every card that leaves is public." },
  { at: 30, text: "A case costs one dollar, and that dollar buys a real Megapot lottery ticket, in the same transaction." },
  { at: 38, text: "The same transaction draws one card. The wait you are watching is the covalidators decrypting it." },
  { at: 46, text: "This one added nothing on top of the ticket, and most do not. That is the honest case, and the game says so plainly." },
  { at: 62, text: "Up to ten cases in a single transaction. Each strip brakes onto the value the chain returned." },
  { at: 82, text: "Here, TESA. Five shards make one more real ticket." },
  { at: 90, text: "The pool moved: one hundred ninety four of two hundred still sealed. Anyone can recount it." },
  { at: 98, text: "And anyone can cut their own deck, write its drop table, and take a share of the commission it earns." },
];

const say = (s) => console.log(s);

async function pickVoice() {
  if (VOICE) return VOICE;
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
  if (!r.ok) throw new Error(`voices: ${r.status} ${(await r.text()).slice(0, 160)}`);
  const { voices } = await r.json();
  const pick =
    voices.find((v) => /adam|daniel|george|brian/i.test(v.name)) ??
    voices.find((v) => v.category === "premade") ??
    voices[0];
  say(`: ${pick.name} (${pick.voice_id})`);
  return pick.voice_id;
}

(async () => {
  if (!KEY) throw new Error("ELEVEN_API_KEY (sk_)");
  if (!fs.existsSync(SRC)) throw new Error(`: ${SRC}`);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  const voice = await pickVoice();

  const parts = [];
  for (const [i, line] of LINES.entries()) {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": KEY, "content-type": "application/json" },
        body: JSON.stringify({
          text: line.text,
          model_id: MODEL,
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15 },
        }),
      },
    );
    if (!r.ok) throw new Error(`tts ${i}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const file = path.join(WORK, `p${i}.mp3`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    const dur = Number(
      execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", file,
      ]).toString().trim(),
    );
    parts.push({ ...line, file, dur });
    say(`  ${String(line.at).padStart(5)}s  ${dur.toFixed(1)}s  ${line.text.slice(0, 58)}…`);
  }

  for (let i = 1; i < parts.length; i++) {
    const end = parts[i - 1].at + parts[i - 1].dur;
    if (end > parts[i].at) {
      say(`  ⚠ ${i} ${(end - parts[i].at).toFixed(1)}`);
    }
  }

  const inputs = parts.flatMap((p) => ["-i", p.file]);
  const delays = parts
    .map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[a${i}]`)
    .join(";");
  const mix = `${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length}:normalize=0[voice]`;

  execFileSync(
    "ffmpeg",
    [
      "-v", "error", "-i", SRC, ...inputs,
      "-filter_complex", `${delays};${mix}`,
      "-map", "0:v", "-map", "[voice]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest", "-movflags", "+faststart", "-y", OUT,
    ],
    { stdio: "inherit" },
  );
  say(`\n: ${OUT}`);
})().catch((e) => {
  console.error(":", e.message);
  process.exit(1);
});
