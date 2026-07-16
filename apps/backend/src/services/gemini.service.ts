import { GoogleGenerativeAI } from "@google/generative-ai";
import { setting, geminiKeys } from "./settings.service";
import { AppError } from "../middleware/error-handler";
import { alertOwnerOnKeyError } from "./owner-alert.service";

// Errors that mean "this key is unusable" — try the next key instead of failing.
const KEY_ERR = /quota|429|exhausted|rate.?limit|invalid.*key|api key|permission|403|401|unauthor|billing|credit/i;

// Run a Gemini call with automatic key fallback: primary → backup 1 → backup 2.
// Only key/quota errors trigger a fallback; a real error (bad request, etc.)
// throws immediately. Alerts the owner when every key is exhausted.
export async function withGeminiModel<T>(
  generationConfig: any,
  fn: (model: any) => Promise<T>,
): Promise<T> {
  const keys = geminiKeys();
  if (!keys.length) throw new AppError(503, "AI is not configured. Set GEMINI_API_KEY.");
  const modelName = setting("GEMINI_MODEL") || "gemini-1.5-flash";

  let lastErr: any;
  for (let i = 0; i < keys.length; i++) {
    try {
      const model = new GoogleGenerativeAI(keys[i]!).getGenerativeModel({ model: modelName, generationConfig });
      return await fn(model);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      if (!KEY_ERR.test(msg)) throw e; // not a key issue → don't burn other keys
      console.warn(`[gemini] key ${i + 1}/${keys.length} failed: ${msg}`);
      if (i === keys.length - 1) void alertOwnerOnKeyError("Gemini (AI)", msg);
    }
  }
  throw lastErr;
}
