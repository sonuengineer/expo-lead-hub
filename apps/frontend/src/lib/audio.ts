// One shared <audio> element, reused for all narration clips. iOS only allows
// audio after a user tap, so we "unlock" this element inside the tap that
// starts the audit — then later programmatic clips on the SAME element play.

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

let el: HTMLAudioElement | null = null;
function getEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.setAttribute("playsinline", "true");
    el.preload = "auto";
  }
  return el;
}

// Call inside a user gesture (the button that starts the audit).
export function unlockAudio(): void {
  try {
    const a = getEl();
    a.src = SILENT_WAV;
    const p = a.play();
    if (p) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Play a clip on the shared element. Resolves false if the browser blocks it
// (e.g. iOS without a prior unlock) so the caller can fall back to the voice.
export async function playUrl(url: string): Promise<boolean> {
  try {
    const a = getEl();
    a.src = url;
    a.currentTime = 0;
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export function stopAudio(): void {
  if (el) {
    try {
      el.pause();
      el.src = "";
    } catch {
      /* ignore */
    }
  }
}
