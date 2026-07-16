import { geminiKeys, setting } from "./settings.service";
import { alertOwnerOnKeyError } from "./owner-alert.service";

// Gemini text-to-speech for the audit narration. Uses the same Gemini key(s)
// (no separate vendor / card). Returns a playable WAV data URL, or null so the
// frontend falls back to the free browser voice.

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const KEY_ERR = /quota|429|exhausted|rate.?limit|invalid.*key|api key|permission|403|401|unauthor|billing|credit/i;

// Voice narration is off unless the owner switches it on in Settings.
export function aiVoiceEnabled(): boolean {
  return (setting("AI_VOICE_PROVIDER") || "browser").toLowerCase() === "gemini";
}

// Wrap raw PCM (16-bit mono) in a WAV container so browsers can play it.
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bits = 16;
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Synthesize `text` → WAV data URL. Tries each Gemini key in turn; returns null
// (so the caller uses the browser voice) if disabled or all keys fail.
export async function synthesizeSpeech(text: string): Promise<string | null> {
  if (!aiVoiceEnabled()) return null;
  const clean = text.trim().slice(0, 400);
  if (!clean) return null;

  const voice = setting("GEMINI_TTS_VOICE") || "Kore";
  const keys = geminiKeys();
  let lastErr = "";

  for (const key of keys) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: clean }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
        },
      );

      if (!resp.ok) {
        lastErr = `${resp.status} ${await resp.text().catch(() => "")}`.slice(0, 300);
        if (KEY_ERR.test(lastErr)) continue; // quota/key issue → try next key
        break;
      }

      const data: any = await resp.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
      const b64: string | undefined = part?.inlineData?.data;
      if (!b64) {
        lastErr = "no audio in Gemini response";
        break;
      }
      const mime: string = part.inlineData.mimeType || "";
      const rate = parseInt(/rate=(\d+)/.exec(mime)?.[1] ?? "24000", 10);
      const wav = pcmToWav(Buffer.from(b64, "base64"), Number.isFinite(rate) ? rate : 24000);
      return `data:audio/wav;base64,${wav.toString("base64")}`;
    } catch (e: any) {
      lastErr = String(e?.message || e).slice(0, 300);
    }
  }

  if (lastErr) void alertOwnerOnKeyError("Gemini TTS (voice)", lastErr);
  return null;
}
