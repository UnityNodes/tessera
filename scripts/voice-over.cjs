// Narration for the demo film through ElevenLabs.
//
//   ELEVEN_API_KEY=sk_... node voice-over.cjs [path-to-mp4]
//
// Every line is synthesised SEPARATELY and laid onto its own second rather than
// read as one long track. The reason is simple: a long take drifts away from the
// picture by the second minute, and the only fix is a re-record. Line by line,
// every remark is tied to the frame it explains, and moving one does not drag the
// rest with it.
//
// The silence between lines is deliberate too. The film shows the game rather
// than a talk about it; a continuous voice would make you watch a mouth instead
// of the screen.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const KEY = process.env.ELEVEN_API_KEY;
const SRC = process.argv[2] ?? "/tmp/tessera-demo2/tessera-demo.mp4";
const OUT = process.env.OUT ?? "/tmp/tessera-demo2/tessera-demo-voiced.mp4";
const WORK = "/tmp/tessera-vo";
// The default voice is a calm English narrator. Overridden by a variable,
// because the available voices depend on the account.
// Daniel, "steady broadcaster". Not a taste: chosen on Covenant and written into
// the knowledge base, for unusual claims an even delivery is more convincing than
// a warm narrator. This voice runs at about 2.7 words per second, and the word
// budget per pause is computed from that.
const VOICE = process.env.ELEVEN_VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9";
const WORDS_PER_S = 2.7;
const MODEL = process.env.ELEVEN_MODEL ?? "eleven_multilingual_v2";

/**
 * The script, tied to the frames.
 *
 * `at` is the second the line starts on. The numbers are not off the ceiling:
 * they are checked against what is really on screen at that moment (frames were
 * taken and looked at). The picture must not be changed without checking these
 * numbers again.
 */
const LINES = [
  { at: 1.5, text: "Tessera is a case opening game on Base, where the odds are a fact you can recount, not a claim we make." },
  { at: 10, text: "Every deck is an encrypted list, shuffled on chain by Inco. Nobody can see what is inside. Not the players, and not us." },
  { at: 20, text: "A deck is finite. Cards come out in order, without replacement, and every card that leaves is public." },
  { at: 30, text: "A case costs one dollar, and that dollar buys a real Megapot lottery ticket, in the same transaction." },
  { at: 38, text: "The same transaction draws one card. The wait you are watching is the covalidators decrypting it." },
  { at: 46, text: "This one added nothing on top of the ticket, and most do not. That is the honest case, and the game says so plainly." },
  { at: 55, text: "Either way the ticket is already yours. The case only ever rides on top of it." },
  { at: 62, text: "Up to ten cases in a single transaction. Each strip brakes onto the value the chain returned." },
  { at: 70, text: "Nothing is decided on our side. The chain answers first, and only then does a strip stop." },
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
  // We take the first English voice from the premade category, they exist on any
  // account. The exact choice is overridden by ELEVEN_VOICE_ID.
  const pick =
    voices.find((v) => /adam|daniel|george|brian/i.test(v.name)) ??
    voices.find((v) => v.category === "premade") ??
    voices[0];
  say(`voice: ${pick.name} (${pick.voice_id})`);
  return pick.voice_id;
}

(async () => {
  if (!KEY) throw new Error("no ELEVEN_API_KEY (it starts with sk_)");
  if (!fs.existsSync(SRC)) throw new Error(`no source video: ${SRC}`);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  const voice = await pickVoice();

  // The word budget for each pause, before synthesis, while a fix is free. It
  // was the absence of this step that spoiled the Covenant film: lines of 13 to
  // 20 seconds were put into gaps of 6 to 7.
  for (let i = 0; i < LINES.length; i++) {
    const gap = (LINES[i + 1]?.at ?? 110.32) - LINES[i].at;
    const words = LINES[i].text.split(/\s+/).length;
    const need = words / WORDS_PER_S;
    if (need > gap) {
      say(`  ! line ${i + 1}: ${words} words is about ${need.toFixed(1)}s into a gap of ${gap.toFixed(1)}s`);
    }
  }

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
          // Stability above the usual: this is voice over rather than an
          // actress's performance, and a wandering intonation on technical words
          // reads as a mispronunciation.
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

  // We lay them out SEQUENTIALLY rather than by the written seconds.
  //
  // This has already cost one spoiled film (Covenant, 8 August): lines placed
  // each on its own beat spoke at the same time, because the text was written
  // "as it reads nicely" rather than to the real pauses. Two voices at once are
  // far worse to hear than a one second delay, so a line never starts before the
  // previous one has finished.
  //
  // A side benefit: the script survives a reshoot. If the picture moves, the
  // narration moves with it, without retiming everything by hand.
  let cursor = 0;
  for (const part of parts) {
    part.start = Math.max(part.at, cursor);
    if (part.start > part.at + 0.05) {
      say(`  -> "${part.text.slice(0, 34)}..." shifted by +${(part.start - part.at).toFixed(1)}s`);
    }
    cursor = part.start + part.dur + 0.3;
  }
  if (cursor > 110.5) {
    say(`  ! the narration is ${(cursor - 110.32).toFixed(1)}s longer than the film, the lines need shortening`);
  }

  const inputs = parts.flatMap((p) => ["-i", p.file]);
  const delays = parts
    .map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.start * 1000)}|${Math.round(p.start * 1000)}[a${i}]`)
    .join(";");
  // `apad` is not cosmetics but a fix for a cut off tail.
  //
  // The narration is shorter than the film, and `-shortest` cut the VIDEO to it:
  // 110.3 s became 96.8, along with the last frame. We pad the track with
  // silence, and then `-shortest` trims by the video, as intended.
  const mix =
    `${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length}:normalize=0,apad[voice]`;

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
  // Checking the result rather than believing in it. Both measurements were
  // written into the knowledge base after that same spoiled film: the mean volume
  // confirms there is speech at all, and the long silence confirms it did not
  // clump together.
  //
  // `-v error` is not allowed here: it silences exactly what we are measuring.
  // ffmpeg writes its measurements to stderr rather than stdout, hence spawnSync,
  // which hands over both streams. execFileSync returns stdout only, and the
  // check failed on it with `Cannot read properties of null`.
  const probe = (filter) =>
    spawnSync("ffmpeg", ["-hide_banner", "-i", OUT, "-af", filter, "-f", "null", "-"], {
      encoding: "utf8",
    }).stderr ?? "";
  const vol = probe("volumedetect").match(/mean_volume: (-?[\d.]+) dB/);
  const gaps = [...probe("silencedetect=n=-50dB:d=4").matchAll(/silence_duration: ([\d.]+)/g)];
  say(`\nmean volume ${vol ? vol[1] : "?"} dB (speech is normally about -26)`);
  say(`silences longer than 4s: ${gaps.length}${gaps.length ? ": " + gaps.map((g) => g[1] + "s").join(", ") : ""}`);
  say(`\ndone: ${OUT}`);
})().catch((e) => {
  console.error("FAILING:", e.message);
  process.exit(1);
});
