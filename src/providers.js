/* =====================================================================
   StudyMaster AI — modos de uso y proveedores de IA
   1) Demo local (sin IA)  2) Cuenta de Claude  3) API key propia (Gemini · Llama/Groq · Grok/xAI)
   ===================================================================== */

// Dónde corre la página: dentro de Claude (claude.ai, con la cuenta del visitante) o en la web pública (GitHub Pages).
const IN_CLAUDE = typeof window.claude === "object" && window.claude !== null;
const LINKS = {
  claudeApp: "https://claude.ai/artifact/92VXBGiiXZfxxjK2iSa3Fg",
  web: "https://stev291105-wq.github.io/STUDY-AI/",
};

/** Lee una respuesta como JSON con tolerancia: JSON puro, bloque ```json o del primer { al último }. */
function parseLooseJSON(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw { code: "invalid_json", text: t };
}
const blobToBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

// ------------------------------------------------------------------ cuenta de Claude (solo dentro de claude.ai)
function claudeAccountAI(sample, imgMax) {
  return {
    kind: "claude", label: "Claude", budget: 150000, perCall: 10, maxImages: imgMax || 0,
    callJSON: (prompt, { images, tier = "default" } = {}) =>
      sample.json(prompt, { ...(images?.length ? { images } : {}), modelTier: tier, cache: false }),
  };
}

// ------------------------------------------------------------------ API key propia
const PROVIDERS = {
  gemini: {
    label: "Google Gemini", short: "Gemini", tone: "sky", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey",
    note: "Tiene plan gratuito con límites por minuto. Lee imágenes, fotos de apuntes y manuscritos.",
    budget: 150000, perCall: 10, maxImages: 5,
  },
  groq: {
    label: "Llama (vía Groq)", short: "Llama", tone: "mint", keyHint: "gsk_…", keyUrl: "https://console.groq.com/keys",
    note: "Plan gratuito muy rápido. Sus límites de tokens por minuto son bajos: se usa una muestra del material.",
    budget: 24000, perCall: 8, maxImages: 4,
  },
  xai: {
    label: "Grok (xAI)", short: "Grok", tone: "peach", keyHint: "xai-…", keyUrl: "https://console.x.ai",
    note: "API de pago por uso de xAI. Los modelos con visión leen imágenes.",
    budget: 100000, perCall: 10, maxImages: 4,
  },
};
const PROVIDER_KEYS = Object.keys(PROVIDERS);

async function httpJSON(url, init, provider) {
  let res;
  try { res = await fetch(url, init); }
  catch { throw { code: "network", message: `No se pudo conectar con ${PROVIDERS[provider].label} desde el navegador (red o bloqueo CORS).` }; }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;
  const detail = body?.error?.message || body?.message || "";
  if (res.status === 401 || res.status === 403 || /api key|apikey|api_key|unauthor/i.test(detail)) throw { code: "auth", message: AI_ERRORS.auth };
  if (res.status === 429) throw provider === "gemini" ? { code: "gemini_quota" } : { code: "rate_limited", message: AI_ERRORS.rate_limited };
  if (res.status === 404) throw { code: "model", message: AI_ERRORS.model };
  if (res.status === 413) throw { code: "prompt_too_large", message: AI_ERRORS.prompt_too_large };
  throw { code: "api", message: `${PROVIDERS[provider].label} respondió ${res.status}${detail ? ": " + detail.slice(0, 220) : ""}` };
}

/** Lista los modelos de la cuenta (valida la key a la vez) y marca cuáles aceptan imágenes. */
async function listModels(provider, key) {
  if (provider === "gemini") {
    const b = await httpJSON("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }, provider);
    return (b.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/embed|tts|image-generation|aqa|live/i.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), vision: true }));
  }
  const base = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.x.ai/v1";
  const b = await httpJSON(base + "/models", { headers: { Authorization: "Bearer " + key } }, provider);
  return (b.data || [])
    .map((m) => m.id)
    .filter((id) => !/whisper|tts|guard|embed|playai|distil|image-gen|imagine/i.test(id) && !(provider === "xai" && /image/i.test(id) && !/vision/i.test(id)))
    .map((id) => ({ id, vision: provider === "groq" ? /llama-4|vision|scout|maverick/i.test(id) : /vision|grok-4|grok-[5-9]/i.test(id) }));
}

const versionOf = (id) => parseFloat((id.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]) || 0;
/** Elige modelos razonables por defecto; el usuario puede cambiarlos en la lista. */
function pickModels(provider, models) {
  const ids = models.map((m) => m.id);
  const vis = models.filter((m) => m.vision).map((m) => m.id);
  const byVersion = (arr) => [...arr].sort((a, b) => versionOf(b) - versionOf(a));
  if (provider === "gemini") {
    const flash = byVersion(ids.filter((id) => /flash/.test(id) && !/lite|thinking|exp|preview|8b/.test(id)));
    const any = flash[0] || byVersion(ids.filter((id) => /flash|pro/.test(id)))[0] || ids[0];
    return { text: any, vision: any };
  }
  if (provider === "groq") {
    const v = vis.find((id) => /maverick/.test(id)) || vis.find((id) => /scout/.test(id)) || vis[0];
    const t = ids.find((id) => /llama-3\.3-70b/.test(id)) || v || ids.find((id) => /llama/.test(id)) || ids[0];
    return { text: t, vision: v || t };
  }
  const grok = byVersion(ids.filter((id) => /grok/.test(id) && !/mini|image/.test(id)));
  const v = byVersion(vis)[0];
  return { text: grok[0] || ids[0], vision: v || grok[0] || ids[0] };
}

/** Motor con API key: misma interfaz que la cuenta de Claude (callJSON). */
function apiKeyAI(cfg) {
  const P = PROVIDERS[cfg.provider];
  return {
    kind: "api", label: cfg.label || P.short, budget: P.budget, perCall: P.perCall, maxImages: cfg.models?.vision ? P.maxImages : 0,
    async callJSON(prompt, { images } = {}) {
      if (!cfg.key) throw { code: "no_key" };
      const imgs = images?.length ? await Promise.all([...images].map(blobToBase64)) : [];
      const model = imgs.length ? cfg.models.vision : cfg.models.text;
      if (cfg.provider === "gemini") {
        const body = {
          contents: [{ role: "user", parts: [...imgs.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })), { text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        };
        const r = await httpJSON(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key }, body: JSON.stringify(body) }, cfg.provider);
        if (r.promptFeedback?.blockReason) throw { code: "refused" };
        const text = (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (!text) throw { code: r.candidates?.[0]?.finishReason === "SAFETY" ? "refused" : "empty_completion" };
        return parseLooseJSON(text);
      }
      const base = cfg.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.x.ai/v1";
      const content = imgs.length
        ? [{ type: "text", text: prompt }, ...imgs.map((d) => ({ type: "image_url", image_url: { url: "data:image/jpeg;base64," + d } }))]
        : prompt;
      const body = { model, temperature: 0.4, messages: [{ role: "user", content }], ...(imgs.length ? {} : { response_format: { type: "json_object" } }) };
      const r = await httpJSON(base + "/chat/completions",
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key }, body: JSON.stringify(body) }, cfg.provider);
      const text = r.choices?.[0]?.message?.content || "";
      if (!text) throw { code: "empty_completion" };
      return parseLooseJSON(text);
    },
  };
}

// La API key se guarda solo en este navegador: en la sesión actual, o de forma permanente si el usuario lo pide.
const apiSettings = {
  load() {
    const s = pref.get("smai:api", { provider: "gemini", remember: false, models: {} });
    let key = "";
    try { key = (s.remember ? localStorage : sessionStorage).getItem("smai:apikey:" + s.provider) || ""; } catch {}
    return { ...s, key };
  },
  save(s) {
    const { key, ...rest } = s;
    pref.set("smai:api", rest);
    try {
      for (const store of [localStorage, sessionStorage]) store.removeItem("smai:apikey:" + s.provider);
      if (key) (s.remember ? localStorage : sessionStorage).setItem("smai:apikey:" + s.provider, key);
    } catch {}
  },
  keyFor(provider, remember) {
    try { return (remember ? localStorage : sessionStorage).getItem("smai:apikey:" + provider) || ""; } catch { return ""; }
  },
};

// ------------------------------------------------------------------ With Gemini (cuenta de Google + key gratuita de AI Studio)
// La key vive SOLO en este navegador: sessionStorage por defecto, localStorage si el usuario marca «Recordar».
// Nunca se envía a ningún servidor propio (no existe) ni se escribe en la consola.
const GEMINI_KEY = "smai:gemini:key";
const geminiAccount = {
  load() {
    const remember = pref.get("smai:gemini:remember", false);
    let key = "";
    try { key = (remember ? localStorage : sessionStorage).getItem(GEMINI_KEY) || ""; } catch {}
    return { key, remember, model: key ? pref.get("smai:gemini:model", "") : "" };
  },
  save({ key, remember, model }) {
    pref.set("smai:gemini:remember", !!remember);
    pref.set("smai:gemini:model", model || "");
    try {
      localStorage.removeItem(GEMINI_KEY); sessionStorage.removeItem(GEMINI_KEY);
      if (key) (remember ? localStorage : sessionStorage).setItem(GEMINI_KEY, key);
    } catch {}
  },
  clear() { this.save({ key: "", remember: false, model: "" }); },
};
/** Valida la key listando los modelos de la cuenta y elige un único modelo Flash disponible. */
async function connectGemini(key) {
  const models = await listModels("gemini", key);
  const flash = models.map((m) => m.id).filter((id) => /flash/i.test(id) && !/tts|image|audio|live|embed/i.test(id));
  const stable = flash.filter((id) => !/lite|thinking|exp|preview|8b/i.test(id));
  const pick = [...(stable.length ? stable : flash)].sort((a, b) => versionOf(b) - versionOf(a))[0];
  if (!pick) throw { code: "api", message: "Tu cuenta de Google no tiene ningún modelo Gemini Flash disponible." };
  return pick;
}
