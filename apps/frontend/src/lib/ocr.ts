import Tesseract from "tesseract.js";

export interface ParsedCard {
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  website?: string;
  designation?: string;
}

export interface ScanResult {
  rawText: string;
  confidence: number; // 0..1
  parsed: ParsedCard;
}

// Shrink a phone photo before OCR — smaller upload + faster processing.
// Returns a JPEG data URL capped at `maxDim` on the longest side.
export function downscale(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not load image"));
    };
    img.src = url;
  });
}

// Heuristic business-card parser (mirrors the backend's logic).
export function parseBusinessCard(text: string): ParsedCard {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedCard = {};

  for (const line of lines) {
    const email = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (email && !parsed.email) parsed.email = email[0];

    const phone = line.match(/[+]?[(]?[0-9]{2,4}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{3,6}/);
    if (phone && !parsed.phone && phone[0].replace(/\D/g, "").length >= 8) parsed.phone = phone[0].trim();

    const web = line.match(/(https?:\/\/|www\.)[^\s]+\.[a-z]{2,}[^\s]*/i);
    if (web && !parsed.website) parsed.website = web[0];

    if (/^[A-Z][A-Z\s&.,-]{4,}$/.test(line) && !parsed.companyName && !line.includes("@")) {
      parsed.companyName = line;
    }

    const titles = ["Manager", "Director", "President", "CEO", "CTO", "CFO", "Sales", "Engineer", "Developer", "Consultant", "Head", "Officer", "Executive", "Founder", "Owner", "Partner"];
    if (!parsed.designation && titles.some((t) => new RegExp(`\\b${t}\\b`, "i").test(line))) {
      parsed.designation = line;
    }
  }

  // Name = first line that isn't the company/email/phone/website.
  const nameLine = lines.find(
    (l) =>
      l !== parsed.companyName &&
      !l.includes("@") &&
      !/\d{3,}/.test(l) &&
      /^[A-Za-z][A-Za-z.\s]{2,40}$/.test(l),
  );
  if (nameLine) {
    const parts = nameLine.split(/\s+/);
    parsed.firstName = parts[0];
    if (parts.length > 1) parsed.lastName = parts.slice(1).join(" ");
  }

  return parsed;
}

// Run OCR fully in the browser. onProgress reports 0..1 during recognition.
export async function scanCard(file: File, onProgress?: (p: number) => void): Promise<ScanResult> {
  const dataUrl = await downscale(file);
  const { data } = await Tesseract.recognize(dataUrl, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  const rawText = data.text || "";
  return {
    rawText,
    confidence: (data.confidence || 0) / 100,
    parsed: parseBusinessCard(rawText),
  };
}
