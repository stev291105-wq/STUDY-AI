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
  if (/:\s+\S/.test(t) && !/^(unidad|tema|cap[ií]tulo|m[oó]dulo|bloque|parte|secci[oó]n|lecci[oó]n|resumen|apuntes|gu[ií]a|introducci[oó]n|repaso)\b/i.test(t)) return false;
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
    agent: !proper && /(?:dor|dora|dores|doras|ista|istas|ante|antes|ente|entes|[oó]logo|[oó]loga|[oó]logos|[oó]logas)$/i.test(np[0]),
    gender: det ? (FEM_DET.test(det) ? "f" : "m") : null,
    def: COPULA.test(rest) ? rest.replace(/^(es|son|era|eran|fue|fueron)\s+/i, "").replace(/[.!?]$/, "") : null,
    copula: COPULA.test(rest) ? rest.split(/\s+/)[0].toLowerCase() : null,
  };
}

// Limpieza del texto extraído de PDF: «palabra ,» → «palabra,», «( 1998 )» → «(1998)».
const tidy = (t) => t.replace(/\s+([,.;:!?)\]»])/g, "$1").replace(/([(\[«¿¡])\s+/g, "$1").replace(/\s{2,}/g, " ").trim();
// Referencias de página en los títulos: «Períodos de Calvi (pág. 20)» → «Períodos de Calvi».
const cleanTopic = (t) => t.replace(/\s*\((?:p[áa]gs?|pp?)\.?\s*[\d\s,\-–y]+\)/gi, "").replace(/[:\s]+$/, "").trim() || t;
// Verbos frecuentes y terminaciones verbales: una oración sin verbo es un fragmento, no una afirmación.
const VERB_WORDS = new Set(("es son fue fueron era eran sera seran esta estan estaba estaban estuvo tiene tienen tenia tenian tuvo hay habia ha han " +
  "puede pueden debe deben permite permiten incluye incluyen consiste consisten busca buscan define definen describe describen distingue distinguen " +
  "propone proponen plantea plantean considera consideran utiliza utilizan usa usan produce producen forma forman realiza realizan presenta presentan " +
  "indica indican senala senalan afirma afirman sostiene sostienen implica implican requiere requieren genera generan contiene contienen depende dependen " +
  "existe existen ocurre ocurren aparece aparecen sirve sirven suele suelen denomina denominan llama llaman fija fijan comienza comienzan surge surgen " +
  "explica explican estudia estudian analiza analizan evalua evaluan mide miden aporta aportan establece establecen favorece favorecen").split(" "));
const hasVerb = (t) => {
  const w = t.toLowerCase().split(/[\s,;:()«»"]+/).filter(Boolean);
  return w.some((x, i) => VERB_WORDS.has(normalize(x)) || (x.length > 3 && /(?:ó|aron|ieron|aba|aban|ían)$/.test(x)) || (/^(se|no|lo|le|les|nos)$/.test(w[i - 1] || "") && x.length > 2 && !isStop(x)));
};
// Oraciones que dependen de la anterior («Esta obra…», «Además…»): se muestran con su contexto.
const ANAPHOR = /^(este|esta|estos|estas|esto|ello|dicho|dicha|dichos|dichas|su|sus|además|también|asimismo|así|por ello|por eso|por lo tanto|sin embargo|en cambio|incluye|incluyen|permite|permiten)\b/i;
// Etiquetas genéricas de esquema: valen para preguntas abiertas, no para confundir conceptos entre sí.
const GEN_LABEL = /^(objetivos?|ejemplos?|nota|notas|definici[oó]n|concepto|importante|resumen|caracter[ií]sticas?|funci[oó]n|funciones|causas?|consecuencias?|ventajas?|desventajas?|tipos?|clasificaci[oó]n|idea principal|conclusi[oó]n|conclusiones|autores?|fuente|observaci[oó]n|finalidad|prop[oó]sito|etapas?|fases?)$/i;
/** «Período psicométrico: Binet (1905), Terman (1916)…» → {label, desc}. Null si es una oración normal con dos puntos. */
function parseTerm(line) {
  const m = line.match(/^([^:]{2,60}):\s+(.{8,300})$/);
  if (!m) return null;
  const label = m[1].trim(), desc = m[2].trim().replace(/\.$/, "");
  const lw = label.split(/\s+/);
  if (lw.length > 6 || !/^\p{Lu}/u.test(label) || DET.test(lw[0]) || /\d/.test(label) || lw.some((w) => VERB_WORDS.has(normalize(w)))) return null;
  if ((label.match(/\p{L}/gu) || []).length / label.replace(/\s/g, "").length < 0.85) return null;
  const words = desc.replace(/\([^)]*\)/g, " ").split(/[\s,;]+/).filter((w) => /\p{L}/u.test(w));
  const content = words.filter((w) => !/^(y|e|de|del|la|las|los|el|van|von|da|di|du|le)$/i.test(w));
  const refs = content.length > 0 && content.filter((w) => isCap(w)).length / content.length >= 0.7;
  return { label, desc, refs, generic: GEN_LABEL.test(label) };
}
// Nombres propios citados en una lista de autores: «Sternberg (1998), Fernández Ballesteros y Grigorenko» → [Sternberg, Fernández Ballesteros, Grigorenko].
const refNames = (desc) => desc.replace(/\([^)]*\)/g, ",").split(/\s*(?:,|;|\by\b|\be\b)\s*/).map((x) => x.trim()).filter((x) => /^\p{Lu}/u.test(x));

/** Hechos citables con su temática (título del apartado, diapositiva o página) y las oraciones vecinas como contexto. */
function buildFacts(files) {
  const facts = [];
  const midCaps = new Set();
  const pending = [];
  const sentsBySec = new Map();
  files.forEach((f, fi) => {
    let heading = "";
    f.sections.forEach((sec) => {
      // Solo texto fiable: el texto digital y el OCR con buena confianza; las descripciones visuales no son oraciones del documento.
      if (sec.origin === "visual" || sec.lowConfidence) return;
      const secKey = f.name + "|" + sec.location;
      const all = sentsBySec.get(secKey) || [];
      sentsBySec.set(secKey, all);
      const paras = reflow(sec.text.replace(/\[[^\]]*\]/g, " ")).map((p) => (p ? tidy(p) : p));
      if (sec.origin === "native_text" && paras[0] && headingLike(paras[0]) && (/^Diapositiva/.test(sec.location) || paras.length > 1)) heading = cleanTopic(cleanHeading(paras[0]));
      paras.forEach((p, i) => {
        if (!p) return;
        const next = paras.slice(i + 1).find(Boolean) || "";
        if (headingLike(p)) { if (i > 0 && sec.origin === "native_text" && (next.length >= 30 || parseTerm(next.replace(BULLET, "")))) heading = cleanTopic(cleanHeading(p)); return; }
        const para = p.replace(BULLET, "");
        const base = { doc: f.name, loc: sec.location, topic: heading || cleanTopic(docTitle(f.name)), fi, secKey };
        const term = parseTerm(para);
        if (term) {
          all.push({ t: para, topic: base.topic });
          pending.push({ ...base, text: `${term.label}: ${term.desc}.`, term, si: all.length - 1 });
          return;
        }
        para.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡«"\d])/u).forEach((raw) => {
          const t = raw.replace(/\s+/g, " ").trim();
          if (t.length >= 12) all.push({ t, topic: base.topic });
          const words = t.split(" ");
          const letters = (t.match(/\p{L}/gu) || []).length / Math.max(1, t.length);
          // Solo oraciones completas: terminan en punto, tienen extensión razonable y son texto (no restos de OCR).
          if (!/[.!?]$/.test(t) || t.length < 30 || t.length > 320 || words.length < 6 || letters < 0.6) return;
          words.forEach((w, k) => { if (k > 0 && isCap(w)) midCaps.add(normalize(bare(w))); });
          pending.push({ ...base, text: t, si: all.length - 1 });
        });
      });
    });
  });
  pending.forEach((s) => {
    const all = sentsBySec.get(s.secKey);
    // Contexto: las oraciones vecinas del mismo apartado (nunca de otro tema).
    const near = (k) => (all[k] && all[k].topic === s.topic ? all[k].t : "");
    const ctx = { before: near(s.si - 1), after: near(s.si + 1) };
    if (s.term) { facts.push({ ...s, id: facts.length, subj: null, numbers: [], ctx }); return; }
    const subj = parseSubject(s.text, midCaps);
    // Una oración sin sujeto reconocible ni verbo es un fragmento: no sirve para preguntar.
    if (!subj && !hasVerb(s.text)) return;
    const anaphoric = ANAPHOR.test(s.text);
    if (anaphoric && !ctx.before) return;
    // Cifras de la prosa; los años de las citas («Sternberg (1998)») y las páginas no son datos que estudiar.
    const prose = s.text.replace(/\([^)]*\)/g, " ").replace(/\b(?:p[áa]gs?|pp?)\.\s*\d+/gi, " ");
    facts.push({ ...s, id: facts.length, subj, numbers: prose.match(NUM) || [], anaphoric, ctx });
  });
  return facts;
}

// ------------------------------------------------------------------ utilidades de redacción
const ucFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const npLower = (subj) => (subj.det ? subj.det.toLowerCase() + " " : "") + subj.noun;
// Contracciones: «a el» → «al», «de el» → «del».
const contract = (t) => t.replace(/\b([aA]) el\b/g, "$1l").replace(/\b([dD]e) el\b/g, "$1l");
const stripEnd = (t) => t.replace(/[.!?]+$/, "");
/** Fuente y contexto de un hecho: la oración exacta del material y las oraciones vecinas. */
function cite(f) {
  let t = `Fuente: «${f.doc}» · ${f.loc} (tema «${f.topic}»).\nEl material dice: “${f.text}”`;
  if (f.ctx?.before || f.ctx?.after) t += `\nContexto del apunte: ${[f.ctx.before, f.ctx.after].filter(Boolean).map((x) => `“${x}”`).join(" … ")}`;
  return t;
}
// Contexto previo para oraciones que dependen de la anterior («Esta obra se publicó…»).
const lead = (f) => (f.anaphoric && f.ctx?.before ? `Contexto: «${f.ctx.before}»\n` : "");
// Complemento inicial convertido en aclaración: «En la entrevista abierta, …» → «en la entrevista abierta».
const prefixPhrase = (s) => (s.prefix ? " " + s.prefix.replace(/,\s*$/, "").replace(/^\p{Lu}/u, (c) => c.toLowerCase()) : "");
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
const sameShape = (a, b) => a.subj.plural === b.subj.plural && a.subj.proper === b.subj.proper && a.subj.gender === b.subj.gender && !!a.subj.det === !!b.subj.det && a.subj.agent === b.subj.agent;
const contentWords = (t) => normalize(t).split(" ").filter((w) => w.length > 2 && !isStop(w));
const overlaps = (x, y) => { const A = contentWords(x), B = contentWords(y); return !A.length || !B.length || A.every((w) => B.includes(w)) || B.every((w) => A.includes(w)); };
const sameConcept = (a, b) => normalize(a.subj.noun) === normalize(b.subj.noun) || overlaps(a.subj.noun, b.subj.noun);

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
  const terms = facts.filter((f) => f.term);
  // Con poco material se generan las preguntas que sea posible (la interfaz avisa si salen menos); solo se falla si no hay nada útil.
  if (!withSubj.length && !terms.length && !facts.some((f) => f.numbers.length))
    throw new Error("El modo demo no encontró suficientes oraciones completas en tus documentos. Funciona mejor con Word, PDF o archivos de texto con párrafos redactados; para fotos, esquemas o apuntes a mano usa With Gemini o tu cuenta de Claude.");
  const d = cfg.difficulty, hard = d === "hard" || d === "jacqueline";
  const nOpts = d === "jacqueline" ? 5 : 4;
  const sentences = new Set(facts.map((f) => normalize(f.text)));
  // Opciones: la correcta y hasta nOpts-1 distractores; con menos de dos distractores no hay pregunta.
  const optionsWith = (right, others) => {
    const pool = [...new Set(others.map(ucFirst))].filter((x) => normalize(x) !== normalize(right));
    return pool.length >= 2 ? shuffle([ucFirst(right), ...pool.slice(0, nOpts - 1)]) : null;
  };
  // Todas las oraciones de un mismo concepto en el mismo documento: la «ficha» que sirve de respuesta modelo.
  const card = (f) => {
    if (f.term) return `${f.term.label}: ${f.term.desc}.`;
    const mine = withSubj.filter((x) => x.fi === f.fi && sameConcept(x, f));
    const exact = (x) => normalize(x.subj.noun) === normalize(f.subj.noun);
    return [f, ...mine.filter((x) => x !== f && exact(x)), ...mine.filter((x) => !exact(x))].map((x) => x.text).slice(0, 3).join(" ");
  };
  // Otros conceptos comparables del mismo documento (nunca de otro documento), del mismo tema primero en niveles altos.
  const peers = (f, { sameTopic = false, defs = false } = {}) => {
    const seen = new Set([normalize(f.subj.noun)]);
    const list = withSubj.filter((x) => x.fi === f.fi && !sameConcept(x, f) && sameShape(x, f) && (!defs || x.subj.def)
      && !normalize(f.text).includes(normalize(x.subj.noun)) && (!sameTopic || x.topic === f.topic));
    const ordered = hard ? [...list.filter((x) => x.topic === f.topic), ...shuffle(list.filter((x) => x.topic !== f.topic))] : shuffle(list);
    const picked = [];
    return ordered.filter((x) => { const k = normalize(x.subj.noun); if (seen.has(k) || picked.some((y) => overlaps(y, x.subj.noun))) return false; seen.add(k); picked.push(x.subj.noun); return true; });
  };
  // Otras entradas «Concepto: descripción» del mismo documento y de la misma clase (listas de autores con listas de autores).
  const termPeers = (f) => {
    const list = terms.filter((x) => x.fi === f.fi && x.id !== f.id && !x.term.generic && x.term.refs === f.term.refs
      && !overlaps(x.term.label, f.term.label) && normalize(x.term.desc) !== normalize(f.term.desc));
    return [...shuffle(list.filter((x) => x.topic === f.topic)), ...shuffle(list.filter((x) => x.topic !== f.topic))];
  };
  // Preferencia por nivel: fácil → definiciones; difícil/Jacqueline → datos concretos y oraciones largas.
  const weight = (f) => (d === "easy" ? (f.subj?.def ? 3 : f.term && !f.term.refs ? 2 : f.subj || f.term ? 1 : 0) - f.text.length / 300
    : d === "medium" ? (f.subj || f.term ? 1 : 0)
    : (f.numbers.length ? 2 : 0) + (f.subj || f.term ? 1 : 0) + f.text.length / 200) + Math.random() * 1.5;
  const ranked = [...facts].sort((a, b) => weight(b) - weight(a));
  const used = new Map(); // id del hecho → tipos ya usados
  const mark = (f, type) => used.set(f.id, [...(used.get(f.id) || []), type]);
  const usable = (f, type) => !(used.get(f.id) || []).includes(type) && (used.get(f.id) || []).length < 2;
  const base = (f, type) => ({ id: uid(), type, topic: f.topic, explanation: cite(f), source: { doc: f.doc, loc: f.loc } });

  const build = {
    multiple_choice(f) {
      const T = f.topic;
      if (f.term) {
        // «¿Con qué concepto relaciona el material a estos autores?» con los otros conceptos del mismo esquema.
        if (f.term.generic) return null;
        const opts = optionsWith(f.term.label, termPeers(f).map((x) => x.term.label));
        if (!opts) return null;
        const prompt = f.term.refs ? `En el tema «${T}», ¿con qué concepto relaciona el material a estos autores?\n«${f.term.desc}»`
          : `En el tema «${T}», ¿a qué concepto corresponde esta descripción del material?\n«${f.term.desc}»`;
        return { ...base(f, "multiple_choice"), prompt, options: opts, answerIndex: opts.indexOf(ucFirst(f.term.label)), explanation: `La respuesta es «${f.term.label}».\n${cite(f)}` };
      }
      // 1) Definición: «¿Qué es la mitocondria?» con definiciones reales de otros conceptos.
      if (f.subj?.def && (d === "easy" || d === "medium" || Math.random() < 0.4)) {
        const opts = optionsWith(f.subj.def, peers(f, { defs: true }).map((x) => x.subj.def));
        if (opts) return { ...base(f, "multiple_choice"), prompt: `En el tema «${T}», ¿qué ${f.subj.copula} ${npLower(f.subj)} según el material?`, options: opts, answerIndex: opts.indexOf(ucFirst(f.subj.def)) };
      }
      // 2) Dato concreto (niveles altos): la cifra exacta.
      if (hard && f.numbers.length) {
        const n = f.numbers[f.numbers.length > 1 && d === "jacqueline" ? 1 : 0];
        const vars = numericVariants(n, f.numbers).slice(0, nOpts - 1);
        if (vars.length >= nOpts - 1) {
          const opts = shuffle([n, ...vars]);
          return { ...base(f, "multiple_choice"), prompt: `${lead(f)}En el tema «${T}», ¿qué dato completa correctamente la afirmación?\n«${replaceOnce(f.text, n, BLANK)}»`, options: opts, answerIndex: opts.indexOf(n) };
        }
      }
      // 3) Concepto: «¿A qué concepto corresponde esta afirmación?» con conceptos del mismo documento y misma concordancia.
      if (f.subj) {
        const others = peers(f, { sameTopic: d === "jacqueline" && peers(f, { sameTopic: true }).length >= nOpts - 1 });
        const opts = optionsWith(f.subj.npText, others.map((x) => x.subj.npText));
        if (opts) {
          const stem = f.subj.prefix ? `${f.subj.prefix}${BLANK} ${f.subj.pred}` : `${BLANK} ${f.subj.pred}`;
          return { ...base(f, "multiple_choice"), prompt: `En el tema «${T}», ¿a qué concepto corresponde esta afirmación?\n«${stem}»`, options: opts, answerIndex: opts.indexOf(ucFirst(f.subj.npText)) };
        }
      }
      return null;
    },

    true_false(f) {
      const T = f.topic, b = base(f, "true_false");
      if (f.term) {
        // Emparejar cada concepto con su descripción; la falsa usa la descripción de otro concepto del mismo esquema.
        if (f.term.generic) return null;
        const pick = termPeers(f)[0];
        const say = (desc) => `Sobre «${T}»: ¿verdadero o falso?\nSegún el material, a «${f.term.label}» le corresponde: ${desc}.`;
        if (!pick || Math.random() < 0.45) return { ...b, prompt: say(f.term.desc), answerBool: true, explanation: `Es verdadera.\n${cite(f)}` };
        return { ...b, prompt: say(pick.term.desc), answerBool: false, explanation: `Es falsa. Eso corresponde a «${pick.term.label}». Para «${f.term.label}», el material indica: ${f.term.desc}.\n${cite(f)}` };
      }
      const falses = [];
      if (f.subj) {
        // Otro concepto comparable del mismo documento: fácil → de otro tema; difícil → del mismo tema (más sutil).
        const pool = peers(f, { sameTopic: hard && peers(f, { sameTopic: true }).length > 0 });
        const pick = d === "easy" ? pool.find((x) => x.topic !== T) || pool[0] : pool[0];
        if (pick) falses.push({ text: swapSubject(f, pick), why: contract(`El material atribuye esto a ${npLower(f.subj)}, no a ${npLower(pick.subj)}.`) });
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
      const ask = (text) => `${lead(f)}Sobre «${T}»: ¿verdadero o falso?\n«${text}»`;
      if (!pickFalse || Math.random() < 0.45) return f.subj || f.numbers.length ? { ...b, prompt: ask(f.text), answerBool: true, explanation: `Es verdadera: el material lo afirma así.\n${cite(f)}` } : null;
      return { ...b, prompt: ask(pickFalse.text), answerBool: false, explanation: `Es falsa. ${pickFalse.why}\n${cite(f)}` };
    },

    fill_blank(f) {
      const T = f.topic;
      const head = `${lead(f)}Completa según el material (tema «${T}»):\n`;
      if (f.term) {
        if (f.term.generic) return null;
        const names = f.term.refs ? refNames(f.term.desc) : [];
        // Jacqueline: el concepto y uno de sus autores.
        if (d === "jacqueline" && names.length > 1) {
          const who = names[0];
          return { ...base(f, "fill_blank"), prompt: `${head}${BLANK}: ${replaceOnce(f.term.desc, who, BLANK)}.`, answers: [[f.term.label], [who]], explanation: `Respuestas: «${f.term.label}» y «${who}».\n${cite(f)}` };
        }
        return { ...base(f, "fill_blank"), prompt: `${head}${BLANK}: ${f.term.desc}.`, answers: [[f.term.label]], explanation: `Respuesta: «${f.term.label}».\n${cite(f)}` };
      }
      const numBlank = f.numbers.length && (hard || !f.subj);
      if (d === "jacqueline" && f.subj && !f.subj.proper && f.numbers.length) {
        // Dos huecos: el concepto y el dato exacto.
        const n = f.numbers[0];
        let prompt = replaceOnce(f.text, f.subj.noun, BLANK);
        prompt = replaceOnce(prompt, n, BLANK);
        return { ...base(f, "fill_blank"), prompt: head + prompt, answers: [[f.subj.noun, f.subj.npText], [n]] };
      }
      if (numBlank) {
        const n = f.numbers[0];
        return { ...base(f, "fill_blank"), prompt: head + replaceOnce(f.text, n, BLANK), answers: [[n]] };
      }
      if (f.subj) {
        const target = f.subj.noun;
        return { ...base(f, "fill_blank"), prompt: head + replaceOnce(f.text, target, BLANK), answers: [[...new Set([target, f.subj.npText])]] };
      }
      return null;
    },

    open(f) {
      const T = f.topic;
      if (f.term) {
        const t = f.term;
        if (hard && !t.generic) {
          // Dos conceptos del mismo esquema y tema: qué incluye cada uno.
          const pair = termPeers(f).find((x) => x.topic === T && usable(x, "open"));
          if (pair) {
            mark(pair, "open");
            const prompt = t.refs ? `En el tema «${T}», ¿qué autores sitúa el material en «${t.label}» y cuáles en «${pair.term.label}»?`
              : `En el tema «${T}», explica y diferencia «${t.label}» y «${pair.term.label}» según el material.`;
            return { ...base(f, "open"), prompt, modelAnswer: `${card(f)}\n${card(pair)}`, keyPoints: t.refs ? [...refNames(t.desc).slice(0, 2), ...refNames(pair.term.desc).slice(0, 2)] : [...keyIdeas(t.desc, 2), ...keyIdeas(pair.term.desc, 2)], explanation: `${cite(f)}\n${cite(pair)}` };
          }
        }
        const prompt = t.refs ? `En el tema «${T}», ¿qué autores asocia el material con «${t.label}»?`
          : t.generic ? `En el tema «${T}», ¿qué indica el material como «${t.label.toLowerCase()}»?`
          : `En el tema «${T}», explica «${t.label}» según el material.`;
        const kp = t.refs ? refNames(t.desc).slice(0, 4) : keyIdeas(t.desc, 4);
        return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
      }
      if (!f.subj) return null;
      const s = f.subj, np = npLower(s), pp = prefixPhrase(s);
      if (d === "hard" || d === "jacqueline") {
        // Relacionar o comparar dos conceptos del mismo documento (mismo núcleo o mismo tema).
        const headWord = normalize(s.noun.split(" ")[0]);
        const cands = s.prefix ? [] : withSubj.filter((x) => x.fi === f.fi && !x.subj.prefix && !sameConcept(x, f) && usable(x, "open"));
        const pair = (d === "jacqueline" ? cands.find((x) => normalize(x.subj.noun.split(" ")[0]) === headWord) : null) || cands.find((x) => x.topic === T);
        if (pair) {
          mark(pair, "open");
          const other = npLower(pair.subj);
          const where = pair.topic === T ? ` (tema «${T}»)` : ` (temas «${T}» y «${pair.topic}»)`;
          // Solo se pide «comparar» conceptos de la misma clase («entrevista abierta» y «entrevista cerrada»); si no, su relación.
          const comparable = normalize(pair.subj.noun.split(" ")[0]) === headWord;
          const prompt = d === "jacqueline"
            ? (comparable ? `Compara ${np} y ${other}${where}: ¿en qué se parecen y en qué se diferencian según el material? Sé preciso con los datos.`
              : `¿Qué relación hay entre ${np} y ${other}${where} según el material? Explícala con los datos exactos que aporta.`)
            : `En el tema «${T}», explica qué dice el material sobre ${np} y sobre ${other}, y cómo se relacionan.`;
          return { ...base(f, "open"), prompt, modelAnswer: `${card(f)}\n\n${card(pair)}`, keyPoints: [...new Set([...keyIdeas(s.pred, 2, s.noun), ...keyIdeas(pair.subj.pred, 2, pair.subj.noun)])], explanation: `${cite(f)}\n${cite(pair)}` };
        }
      }
      // La pregunta pide solo lo que el material contesta: «¿qué es…?» únicamente si hay definición.
      const prompt = s.def && d === "easy" ? `En el tema «${T}», ¿qué ${s.copula} ${np} según el material?`
        : s.def ? `En el tema «${T}», describe ${np}: ¿qué ${s.plural ? "son" : "es"} y qué características ${s.plural ? "tienen" : "tiene"} según el material?`
        : s.proper && !s.det && !s.prefix ? `En el tema «${T}», ¿qué hizo ${np} según el material y por qué es relevante?`
        : `En el tema «${T}», ¿qué dice el material sobre ${np}${pp}?${d === "easy" ? "" : " Incluye los datos que aporta."}`;
      const kp = keyIdeas(card(f), 4, s.noun);
      return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
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
