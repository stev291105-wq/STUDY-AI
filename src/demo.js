/* =====================================================================
   StudyMaster AI — motor demo local (sin IA)
   El texto se reconstruye en párrafos, se divide en oraciones completas y de cada
   oración se extrae un hecho: su sujeto (el concepto), lo que se dice de él y, si
   la hay, una definición o una cifra. Las preguntas se construyen desde esos hechos,
   así que siempre son oraciones completas, con su tema y una respuesta verificable.
   ===================================================================== */

const STOP = new Set(("a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estado estan estar estas este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mismo mucho muy nada ni no nos o otra otras otro otros para pero poco por porque pues que quien se sea segun ser si sin sobre son su sus tal tambien tanto te tiene tienen todo todos tras tu un una unas uno unos y ya cual cada dicho dicha hace hacen puede pueden debe deben the of and to in is are was were be by for with as on at from that this these those it its an or not can will has have had which").split(" "));
const isStop = (w) => STOP.has(normalize(w));
// Sustantivos genéricos que no sirven como concepto preguntado.
const GENERIC = new Set("parte partes paso pasos zona zonas material materiales toma forma formas tipo tipos caso casos vez veces manera modo lado nivel niveles mayor menor mitad miles cantidad numero numeros periodo simbolo resto conjunto ejemplo ejemplos punto puntos cosa cosas aspecto aspectos elemento elementos region regiones grupo grupos base informacion lugar momento tiempo año años dia dias resultado resultados".split(" "));

// Título del documento sin extensión ni prefijos ("Ejemplo · La célula.txt" → "La célula").
const docTitle = (name) => {
  const t = name.replace(/\.[^.]+$/, "").replace(/^ejemplo\s*·\s*/i, "").replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const cleanHeading = (t) => t.replace(/^(?:[•\-–*·]\s*)/, "").replace(/[:\s]+$/, "").trim();
function headingLike(line) {
  const t = cleanHeading(line);
  if (t.length < 3 || t.length > 70 || /[.;,]$/.test(line.trim())) return false;
  if (t.split(/\s+/).length > 9 || !/^[\p{Lu}\d¿¡]/u.test(t)) return false;
  return (t.match(/\p{L}/gu) || []).length / t.length > 0.6;
}
const BULLET = /^(?:[•\-–*·▪►]\s*|\d{1,2}[.)]\s+)/;
const JOINER = /\b(de|del|la|el|los|las|y|e|o|u|que|en|a|al|con|por|para|un|una|su|sus|se|lo|como|entre|sobre|sin|desde|hasta)$/i;

/**
 * Une las líneas que el PDF o el OCR cortaron por el ancho de la página y quita los
 * guiones de corte de palabra, para recuperar párrafos y oraciones completas.
 */
function reflow(text) {
  const out = [];
  let blankRun = 0;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { blankRun++; continue; }
    const li = out.length - 1, prev = li >= 0 ? out[li] : "";
    const continues = prev && blankRun <= 1 && !/[.!?:;]$/.test(prev) && !BULLET.test(line) && !headingLike(prev)
      && (/^[\p{Ll}\d(«"]/u.test(line) || /[-,]$/.test(prev) || JOINER.test(prev));
    if (continues) out[li] = /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(line) ? prev.slice(0, -1) + line : prev + " " + line;
    else { if (blankRun && out.length) out.push(""); out.push(line); }
    blankRun = 0;
  }
  return out;
}

const tokens = (t) => t.match(/[\p{L}\p{N}][\p{L}\p{N}%,.\-]*[\p{L}\p{N}%]|[\p{L}\p{N}]/gu) || [];
const DET = /^(el|la|los|las|un|una|unos|unas)$/i;
const FEM_DET = /^(la|las|una|unas)$/i;
const PLURAL_DET = /^(los|las|unos|unas)$/i;
const LEAD_PREP = /^(en|durante|según|para|con|desde|tras|ante|bajo|sobre|entre|hacia|hasta|por|sin|aproximadamente|además|asimismo|finalmente|actualmente|hoy)$/i;
const VERBISH = new Set("es son fue fueron era eran sera seran esta estan estaba estaban estuvo tiene tienen tenia tuvo hay se no ha han habia habian puede pueden debe deben ya tambien solo".split(" "));
const ADJ = /(al|ales|ar|ares|ico|ica|icos|icas|ivo|iva|ivos|ivas|oso|osa|osos|osas|ble|bles|ente|entes|ante|antes|ota|otas|ario|aria|arios|arias|ano|ana|anos|anas|ino|ina|inos|inas|eo|ea|eos|eas|ular|ulares|ista|istas|ófilo|ófila|ófilos|ófilas)$/i;
const COPULA = /^(es|son|era|eran|fue|fueron)\s+(un|una|unos|unas|el|la|los|las)\s/i;
const NUM = /\b\d+(?:[.,]\d+)?\b/g;
const bare = (w) => w.replace(/[,;:.]+$/, "");
const isCap = (w) => /^\p{Lu}/u.test(w);

/**
 * Sujeto de la oración: «La membrana plasmática», «El aparato de Golgi», «Napoleón Bonaparte»,
 * también tras un complemento inicial («En el ser humano, las células somáticas…»).
 * Devuelve null si la oración no empieza por un sujeto reconocible.
 */
function parseSubject(sent, midCaps) {
  let prefix = "", words = sent.split(/\s+/);
  if (LEAD_PREP.test(bare(words[0]))) {
    const c = sent.indexOf(", ");
    if (c < 0 || c > 90) return null;
    prefix = sent.slice(0, c + 2);
    words = sent.slice(c + 2).split(/\s+/);
  }
  let i = 0, det = null;
  if (DET.test(words[0])) { det = words[0]; i = 1; }
  if (!words[i]) return null;
  const np = [];
  const endsClause = (w) => /[,;:]$/.test(w);
  let proper = false;
  if (isCap(words[i])) {
    // Nombre propio: «Revolución Francesa», «Declaración de los Derechos del Hombre y del Ciudadano».
    proper = true;
    np.push(bare(words[i])); i++;
    while (i < words.length && !endsClause(words[i - 1])) {
      if (isCap(words[i])) { np.push(bare(words[i])); i++; continue; }
      let j = i;
      while (j < words.length && j - i < 3 && /^(de|del|la|las|los|el|y|e)$/i.test(words[j])) j++;
      if (j > i && j < words.length && isCap(words[j])) { np.push(...words.slice(i, j)); i = j; continue; }
      break;
    }
    // Una sola palabra en mayúscula al inicio solo es nombre propio si aparece así a mitad de frase.
    if (!det && np.length < 2 && !midCaps.has(normalize(np[0]))) return null;
  } else {
    const head = bare(words[i]);
    if (!det || !/^\p{Ll}/u.test(head) || head.length < 3 || isStop(head) || VERBISH.has(normalize(head)) || GENERIC.has(normalize(head)) || /\d/.test(head)) return null;
    np.push(head); i++;
    while (i < words.length && np.length < 4 && !endsClause(words[i - 1])) {
      const w = bare(words[i]);
      if (/^\p{Ll}/u.test(w) && ADJ.test(w) && !VERBISH.has(normalize(w))) { np.push(w); i++; continue; }
      if (/^(de|del)$/i.test(words[i]) && words[i + 1] && isCap(words[i + 1])) { np.push(words[i], bare(words[i + 1])); i += 2; continue; }
      // «El ciclo del carbono», «La teoría de la evolución»: un complemento con «de» forma parte del concepto.
      if (np.length <= 2 && !np.some((w) => /^(de|del)$/i.test(w)) && /^(de|del)$/i.test(words[i])) {
        let j = i + 1;
        if (/^(la|las|los|el)$/i.test(words[j] || "")) j++;
        const w2 = bare(words[j] || "");
        if (/^\p{Ll}/u.test(w2) && w2.length >= 3 && !isStop(w2) && !VERBISH.has(normalize(w2)) && !endsClause(words[j - 1])) { np.push(...words.slice(i, j), w2); i = j + 1; break; }
      }
      break;
    }
  }
  let rest = words.slice(i).join(" ").trim();
  // Aposición entre comas: «Las células procariotas, como las bacterias, no tienen…»
  if (endsClause(words[i - 1])) {
    const m = rest.match(/^(como|es decir|o sea|también llamad[oa]s?|que)\b[^,]{0,70},\s*/i);
    if (!m) return null;
    rest = rest.slice(m[0].length);
  }
  if (!/^\p{Ll}/u.test(rest) || rest.split(/\s+/).length < 3) return null;
  const noun = np.join(" ");
  const npText = (det ? det + " " : "") + noun;
  return {
    prefix, det, noun, npText, proper, pred: rest,
    plural: det ? PLURAL_DET.test(det) : false,
    gender: det ? (FEM_DET.test(det) ? "f" : "m") : null,
    def: COPULA.test(rest) ? rest.replace(/^(es|son|era|eran|fue|fueron)\s+/i, "").replace(/[.!?]$/, "") : null,
    copula: COPULA.test(rest) ? rest.split(/\s+/)[0].toLowerCase() : null,
  };
}

/** Hechos citables con su temática (título del apartado, diapositiva o página). */
function buildFacts(files) {
  const facts = [];
  const midCaps = new Set();
  const pending = [];
  files.forEach((f, fi) => {
    let heading = "";
    f.sections.forEach((sec) => {
      // Solo texto fiable: el texto digital y el OCR con buena confianza; las descripciones visuales no son oraciones del documento.
      if (sec.origin === "visual" || sec.lowConfidence) return;
      const paras = reflow(sec.text.replace(/\[[^\]]*\]/g, " "));
      if (sec.origin === "native_text" && paras[0] && headingLike(paras[0]) && (/^Diapositiva/.test(sec.location) || paras.length > 1)) heading = cleanHeading(paras[0]);
      paras.forEach((p, i) => {
        if (!p) return;
        const next = paras.slice(i + 1).find(Boolean) || "";
        if (headingLike(p)) { if (i > 0 && sec.origin === "native_text" && next.length >= 40 && /[.!?]$/.test(next)) heading = cleanHeading(p); return; }
        const para = p.replace(BULLET, "");
        para.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡«"\d])/u).forEach((raw) => {
          const t = raw.replace(/\s+/g, " ").trim();
          const words = t.split(" ");
          const letters = (t.match(/\p{L}/gu) || []).length / Math.max(1, t.length);
          // Solo oraciones completas: terminan en punto, tienen extensión razonable y son texto (no restos de OCR).
          if (!/[.!?]$/.test(t) || t.length < 30 || t.length > 320 || words.length < 6 || letters < 0.6) return;
          words.forEach((w, k) => { if (k > 0 && isCap(w)) midCaps.add(normalize(bare(w))); });
          pending.push({ text: t, doc: f.name, loc: sec.location, topic: heading || docTitle(f.name), fi, secKey: f.name + "|" + sec.location });
        });
      });
    });
  });
  pending.forEach((s, id) => {
    const subj = parseSubject(s.text, midCaps);
    facts.push({ ...s, id, subj, numbers: s.text.match(NUM) || [] });
  });
  return facts;
}

// ------------------------------------------------------------------ utilidades de redacción
const ucFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const npLower = (subj) => (subj.det ? subj.det.toLowerCase() + " " : "") + subj.noun;
const stripEnd = (t) => t.replace(/[.!?]+$/, "");
const cite = (f) => `Según «${f.doc}» · ${f.loc} (tema «${f.topic}»): “${f.text}”`;
const replaceOnce = (text, term, by) => { const i = text.indexOf(term); return i < 0 ? text : text.slice(0, i) + by + text.slice(i + term.length); };
/** La oración con el sujeto cambiado por otro concepto (manteniendo mayúsculas y concordancia). */
function swapSubject(f, other) {
  const s = f.subj, o = other.subj;
  const replacement = s.prefix || !f.text.startsWith(s.npText) ? npLower(o) : ucFirst(o.npText);
  const at = f.text.indexOf(s.npText) >= 0 ? s.npText : s.npText.charAt(0).toLowerCase() + s.npText.slice(1);
  return replaceOnce(f.text, at, replacement);
}
function numericVariants(raw, avoid = []) {
  const dec = raw.includes(",") ? "," : ".";
  const n = parseFloat(raw.replace(",", "."));
  const isInt = Number.isInteger(n);
  const fmt = (x) => (isInt ? String(Math.round(x)) : x.toFixed((raw.split(/[.,]/)[1] || "").length).replace(".", dec));
  const year = isInt && n >= 1000 && n <= 2100;
  const pool = year ? [n + 1, n - 1, n + 2, n - 3, n + 5, n - 10] : n <= 12 && isInt ? [n + 1, n - 1, n + 2, n * 2] : [n + 1, n - 1, Math.round(n * 1.1), Math.round(n * 0.9), n * 2, Math.round(n / 2)];
  return [...new Set(pool.filter((x) => x > 0).map(fmt))].filter((x) => x !== raw && !avoid.includes(x));
}
/** Ideas clave de un texto: sustantivos (palabras tras artículo o preposición) y nombres propios. */
function keyIdeas(text, max = 4, skip = "") {
  const tk = tokens(text), avoid = new Set(normalize(skip).split(" "));
  const nounish = tk.filter((w, i) => w.length >= 4 && !isStop(w) && !GENERIC.has(normalize(w)) && !avoid.has(normalize(w)) && !/^\d+$/.test(w)
    && (isCap(w) || /^(el|la|los|las|un|una|del|al|de|con|por|en|su|sus|entre|sin|sobre)$/i.test(tk[i - 1] || "")));
  return [...new Set(nounish)].slice(0, max);
}
// Comparables: mismo número, mismo género y, si son nombres propios, ambos con artículo («La Revolución Francesa»)
// o ambos sin él (personas: «Napoleón Bonaparte»), para que el cambio no rompa la concordancia ni el sentido.
const sameShape = (a, b) => a.subj.plural === b.subj.plural && a.subj.proper === b.subj.proper && a.subj.gender === b.subj.gender && !!a.subj.det === !!b.subj.det;
const sameConcept = (a, b) => normalize(a.subj.noun) === normalize(b.subj.noun);

/** Revisión final de sentido: descarta preguntas mal formadas, venga de la IA o de las reglas. */
function saneQuestion(q) {
  if (!q || !q.prompt || q.prompt.replace(new RegExp(BLANK, "g"), "").trim().length < 12) return false;
  if (q.type === "multiple_choice") {
    const n = q.options.map(normalize);
    if (n.some((x) => !x) || new Set(n).size !== n.length) return false;
  }
  if (q.type === "true_false" && q.prompt.includes(BLANK)) return false;
  if (q.type === "fill_blank" && q.answers.some((v) => !v.length || v.every((x) => isStop(x) || normalize(x).length < 2))) return false;
  if (q.type === "open" && (!q.modelAnswer || q.modelAnswer.length < 20)) return false;
  return true;
}

function generateLocal(files, cfg) {
  const facts = buildFacts(files);
  const withSubj = facts.filter((f) => f.subj);
  // Con poco material se generan las preguntas que sea posible (la interfaz avisa si salen menos); solo se falla si no hay nada útil.
  if (!withSubj.length && !facts.some((f) => f.numbers.length))
    throw new Error("El modo demo no encontró suficientes oraciones completas en tus documentos. Funciona mejor con Word, PDF o archivos de texto con párrafos redactados; para fotos, esquemas o apuntes a mano usa With Gemini o tu cuenta de Claude.");
  const d = cfg.difficulty, hard = d === "hard" || d === "jacqueline";
  const nOpts = d === "jacqueline" ? 5 : 4;
  const sentences = new Set(facts.map((f) => normalize(f.text)));
  // Todas las oraciones de un mismo concepto en el mismo documento: la «ficha» que sirve de respuesta modelo.
  const card = (f) => withSubj.filter((x) => x.fi === f.fi && sameConcept(x, f)).map((x) => x.text).slice(0, 3).join(" ");
  // Otros conceptos comparables del mismo documento (nunca de otro documento), del mismo tema primero en niveles altos.
  const peers = (f, { sameTopic = false, defs = false } = {}) => {
    const seen = new Set([normalize(f.subj.noun)]);
    const list = withSubj.filter((x) => x.fi === f.fi && !sameConcept(x, f) && sameShape(x, f) && (!defs || x.subj.def)
      && !normalize(f.text).includes(normalize(x.subj.noun)) && (!sameTopic || x.topic === f.topic));
    const ordered = hard ? [...list.filter((x) => x.topic === f.topic), ...shuffle(list.filter((x) => x.topic !== f.topic))] : shuffle(list);
    return ordered.filter((x) => { const k = normalize(x.subj.noun); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  // Preferencia por nivel: fácil → definiciones; difícil/Jacqueline → datos concretos y oraciones largas.
  const weight = (f) => (d === "easy" ? (f.subj?.def ? 3 : f.subj ? 1 : 0) - f.text.length / 300
    : d === "medium" ? (f.subj ? 1 : 0)
    : (f.numbers.length ? 2 : 0) + (f.subj ? 1 : 0) + f.text.length / 200) + Math.random() * 1.5;
  const ranked = [...facts].sort((a, b) => weight(b) - weight(a));
  const used = new Map(); // id del hecho → tipos ya usados
  const mark = (f, type) => used.set(f.id, [...(used.get(f.id) || []), type]);
  const usable = (f, type) => !(used.get(f.id) || []).includes(type) && (used.get(f.id) || []).length < 2;
  const base = (f, type) => ({ id: uid(), type, topic: f.topic, explanation: cite(f), source: { doc: f.doc, loc: f.loc } });

  const build = {
    multiple_choice(f) {
      const T = f.topic;
      // 1) Definición: «¿Qué es la mitocondria?» con definiciones reales de otros conceptos.
      if (f.subj?.def && (d === "easy" || d === "medium" || Math.random() < 0.4)) {
        const others = peers(f, { defs: true }).map((x) => ucFirst(x.subj.def)).filter((x) => normalize(x) !== normalize(f.subj.def));
        if (others.length >= nOpts - 1) {
          const right = ucFirst(f.subj.def), opts = shuffle([right, ...others.slice(0, nOpts - 1)]);
          return { ...base(f, "multiple_choice"), prompt: `En el tema «${T}», ¿qué ${f.subj.copula} ${npLower(f.subj)}?`, options: opts, answerIndex: opts.indexOf(right) };
        }
      }
      // 2) Dato concreto (niveles altos): la cifra exacta.
      if (hard && f.numbers.length) {
        const n = f.numbers[f.numbers.length > 1 && d === "jacqueline" ? 1 : 0];
        const vars = numericVariants(n, f.numbers).slice(0, nOpts - 1);
        if (vars.length >= nOpts - 1) {
          const opts = shuffle([n, ...vars]);
          return { ...base(f, "multiple_choice"), prompt: `En el tema «${T}», ¿qué dato completa correctamente la afirmación?\n«${replaceOnce(f.text, n, BLANK)}»`, options: opts, answerIndex: opts.indexOf(n) };
        }
      }
      // 3) Concepto: «¿A qué concepto corresponde esta afirmación?» con conceptos del mismo documento y misma concordancia.
      if (f.subj) {
        const others = peers(f, { sameTopic: d === "jacqueline" && peers(f, { sameTopic: true }).length >= nOpts - 1 });
        if (others.length >= nOpts - 1) {
          const right = ucFirst(f.subj.npText), opts = shuffle([right, ...others.slice(0, nOpts - 1).map((x) => ucFirst(x.subj.npText))]);
          const stem = f.subj.prefix ? `${f.subj.prefix}${BLANK} ${f.subj.pred}` : `${BLANK} ${f.subj.pred}`;
          return { ...base(f, "multiple_choice"), prompt: `En el tema «${T}», ¿a qué concepto corresponde esta afirmación?\n«${stem}»`, options: opts, answerIndex: opts.indexOf(right) };
        }
      }
      return null;
    },

    true_false(f) {
      const T = f.topic, b = base(f, "true_false");
      const falses = [];
      if (f.subj) {
        // Otro concepto comparable del mismo documento: fácil → de otro tema; difícil → del mismo tema (más sutil).
        const pool = peers(f, { sameTopic: hard && peers(f, { sameTopic: true }).length > 0 });
        const pick = d === "easy" ? pool.find((x) => x.topic !== T) || pool[0] : pool[0];
        if (pick) falses.push({ text: swapSubject(f, pick), why: `El material atribuye esto a ${npLower(f.subj)}, no a ${npLower(pick.subj)}.` });
        if (f.subj.def) falses.push({ text: replaceOnce(f.text, ` ${f.subj.copula} `, ` no ${f.subj.copula} `), why: `El material afirma lo contrario.` });
      }
      if (f.numbers.length) {
        const n = f.numbers[0], v = numericVariants(n, f.numbers)[0];
        if (v) falses.push({ text: replaceOnce(f.text, n, v), why: `El dato correcto es ${n}, no ${v}.` });
      }
      if (/\bno\s+(es|son|tiene|tienen|requiere|requieren|puede|pueden|presenta|presentan)\b/.test(f.text) && !/\bsí\b/i.test(f.text))
        falses.push({ text: f.text.replace(/\bno\s+/, ""), why: `El material dice justo lo contrario.` });
      const order = hard ? [...falses].reverse() : falses;
      const pickFalse = order.find((x) => !sentences.has(normalize(x.text)) && x.text !== f.text);
      if (!pickFalse || Math.random() < 0.45) return f.subj || f.numbers.length ? { ...b, prompt: `Según el tema «${T}»: ${f.text}`, answerBool: true } : null;
      return { ...b, prompt: `Según el tema «${T}»: ${pickFalse.text}`, answerBool: false, explanation: `Es falsa. ${pickFalse.why} ${cite(f)}` };
    },

    fill_blank(f) {
      const T = f.topic;
      const numBlank = f.numbers.length && (hard || !f.subj);
      if (d === "jacqueline" && f.subj && !f.subj.proper && f.numbers.length) {
        // Dos huecos: el concepto y el dato exacto.
        const n = f.numbers[0];
        let prompt = replaceOnce(f.text, f.subj.noun, BLANK);
        prompt = replaceOnce(prompt, n, BLANK);
        return { ...base(f, "fill_blank"), prompt: `Tema «${T}»: ${prompt}`, answers: [[f.subj.noun, f.subj.npText], [n]] };
      }
      if (numBlank) {
        const n = f.numbers[0];
        return { ...base(f, "fill_blank"), prompt: `Tema «${T}»: ${replaceOnce(f.text, n, BLANK)}`, answers: [[n]] };
      }
      if (f.subj) {
        const target = f.subj.noun;
        return { ...base(f, "fill_blank"), prompt: `Tema «${T}»: ${replaceOnce(f.text, target, BLANK)}`, answers: [[...new Set([target, f.subj.npText])]] };
      }
      return null;
    },

    open(f) {
      if (!f.subj) return null;
      const T = f.topic, s = f.subj, np = npLower(s);
      const pl = s.plural;
      if (d === "hard" || d === "jacqueline") {
        // Relacionar o comparar dos conceptos del mismo documento (mismo núcleo o mismo tema).
        const head = normalize(s.noun.split(" ")[0]);
        const cands = withSubj.filter((x) => x.fi === f.fi && !sameConcept(x, f) && usable(x, "open"));
        const pair = (d === "jacqueline" ? cands.find((x) => normalize(x.subj.noun.split(" ")[0]) === head) : null) || cands.find((x) => x.topic === T);
        if (pair) {
          mark(pair, "open");
          const other = npLower(pair.subj);
          const where = pair.topic === T ? ` (tema «${T}»)` : ` (temas «${T}» y «${pair.topic}»)`;
          // Solo se pide «comparar» conceptos de la misma clase («células somáticas» y «células procariotas»); si no, su relación.
          const comparable = normalize(pair.subj.noun.split(" ")[0]) === head;
          const prompt = d === "jacqueline"
            ? (comparable ? `Compara ${np} y ${other}${where}: ¿en qué se parecen y en qué se diferencian según el material? Sé preciso con los datos.`
              : `¿Qué relación hay entre ${np} y ${other}${where} según el material? Explícala con los datos exactos que aporta.`)
            : `En el tema «${T}», explica qué dice el material sobre ${np} y sobre ${other}, y cómo se relacionan.`;
          return { ...base(f, "open"), prompt, modelAnswer: `${card(f)}\n\n${card(pair)}`, keyPoints: [...new Set([...keyIdeas(f.subj.pred, 2, s.noun), ...keyIdeas(pair.subj.pred, 2, pair.subj.noun)])], explanation: `${cite(f)}\n${cite(pair)}` };
        }
      }
      const prompt = s.def && d === "easy" ? `En el tema «${T}», ¿qué ${s.copula} ${np} según el material?`
        : d === "easy" ? `En el tema «${T}», ¿qué explica el material sobre ${np}?`
        : s.proper && !s.det ? `En el tema «${T}», ¿qué hizo ${np} según el material y por qué es relevante?`
        : s.proper ? `En el tema «${T}», ¿qué explica el material sobre ${np}? Incluye los datos que aporta.`
        : `En el tema «${T}», describe ${np}: ¿qué ${pl ? "son" : "es"} y qué función o características ${pl ? "tienen" : "tiene"} según el material?`;
      return { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: keyIdeas(card(f), 4, s.noun) };
    },
  };

  const questions = [];
  for (const type of distribute(cfg.modes, cfg.count)) {
    let made = null;
    for (const f of ranked) {
      if (!usable(f, type)) continue;
      const q = build[type](f);
      if (q && saneQuestion(q) && !questions.some((x) => x.prompt === q.prompt)) { made = q; mark(f, type); break; }
    }
    if (made) questions.push(made);
  }
  if (!questions.length) throw new Error("No se pudieron generar preguntas con este material en modo demo: tiene muy pocas oraciones completas. Prueba con documentos Word, PDF o de texto con párrafos completos, o usa With Gemini o tu cuenta de Claude.");
  return { questions: shuffle(questions), coverage: 100 };
}
