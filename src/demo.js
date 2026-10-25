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
  // Letras frente al resto de signos (sin contar espacios ni cifras: «Tema 12 (pág. 120)» sigue siendo un título).
  return (t.match(/\p{L}/gu) || []).length / Math.max(1, t.replace(/[\s\d]/g, "").length) > 0.75;
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
  // Si tras el concepto sigue una preposición («La evaluación por etapas organiza…»), el concepto está incompleto: no se usa.
  if (/^(por|con|en|sin|para|de|del|a|al|entre|sobre|hacia|desde|hasta|según|mediante|durante|tras|bajo|ante)\s/i.test(rest)) return null;
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
const ANAPHOR = /^(este|esta|estos|estas|esto|ello|dicho|dicha|dichos|dichas|su|sus|así|por ello|por eso|por lo tanto|por esta razón|por este motivo|de ahí|de este modo|de esta manera|sin embargo|no obstante|en cambio|incluye|incluyen|permite|permiten|él|ella|ellos|ellas|ambos|ambas|el primero|el segundo|la primera|la segunda|este último|esta última|lo anterior|los anteriores|las anteriores|tal|tales|allí|aquí|entonces)\b/i;
// Conectores que solo enlazan con lo anterior («Además, …»): se quitan y la oración queda completa por sí sola.
const ADDITIVE = /^(además|asimismo|también|igualmente|por otro lado|por otra parte|finalmente|por último|en primer lugar|en segundo lugar|en tercer lugar|luego|después|a su vez)\s*,\s*/i;
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
  // «Rocío Fernández Ballesteros (española)» → nombre «Rocío Fernández Ballesteros», y se reconoce como persona.
  const name = label.replace(/\s*\([^)]*\)/g, "").trim() || label;
  const nw = name.split(/\s+/);
  const person = nw.length >= 2 && nw.every((w) => isCap(w) || /^(de|del|la|las|los|y|van|von|da|di)$/i.test(w)) && nw.filter(isCap).length >= 2;
  return { label, name, desc, refs, person, generic: GEN_LABEL.test(label) };
}
// Enunciado de una entrada de esquema: «Los autores de X son: …», «X se asocia con: …», «X se describe como: …».
const termSay = (t, desc, blank = false) => {
  const L = blank ? BLANK : `«${t.name}»`;
  return t.refs ? `Los autores de ${L} son: ${desc}.` : t.person ? `${L} se asocia con: ${desc}.` : `${L} se describe como: ${desc}.`;
};
// Limpieza del enunciado: sin referencias a documento, sección, tema o página («Según el material, …», «(pág. 12)»).
function cleanPrompt(p) {
  let t = String(p || "").trim();
  const DOCW = "material|texto|documento|apunte|apuntes|libro|manual|lectura|resumen|archivo|pdf|presentaci[oó]n|diapositiva|secci[oó]n|cap[ií]tulo|apartado|tema|unidad|p[áa]gina";
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t.replace(new RegExp(`^(?:seg[uú]n|de acuerdo con|conforme a|tal como (?:indica|se[ñn]ala|dice))\\s+(?:el|la|los|las|lo que (?:dice|indica) (?:el|la))\\s+(?:${DOCW})\\b[^,:?¿]{0,140}[,:]\\s*`, "i"), "")
      .replace(new RegExp(`^en\\s+(?:el|la|los|las)\\s+(?:${DOCW})\\b[^,:?¿]{0,140}[,:]\\s*`, "i"), "")
      .replace(/^(?:p[áa]gina|p[áa]g\.?|diapositiva|fragmento)\s*\d+(?:\s*\/\s*\d+)?\s*[:,.\-–]\s*/i, "")
      .replace(/^sobre\s+«[^»]{1,120}»\s*[:,]\s*/i, "").replace(/^tema\s+«[^»]{1,120}»\s*[:,.-]\s*/i, "");
    if (t === before) break;
  }
  t = t.replace(/\s*\((?:p[áa]g(?:ina)?s?|pp?)\.?\s*[\d\s,\-–y]+\)/gi, "")
    .replace(new RegExp(`,?\\s+(?:seg[uú]n|de acuerdo con)\\s+(?:el|la)\\s+(?:${DOCW})(?:\\s+de estudio)?(?=\\s*[?.!]|$)`, "gi"), "");
  return t.replace(/^([¿¡«"]?)(\p{Ll})/u, (m, a, c) => a + c.toUpperCase());
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
          let t = raw.replace(/\s+/g, " ").trim();
          if (ADDITIVE.test(t)) t = ucFirst(t.replace(ADDITIVE, ""));
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
    // También dependen de la anterior las que remiten a algo ya dicho («el símbolo de este periodo»).
    const anaphoric = ANAPHOR.test(s.text) || /\b(este|esta|estos|estas|dicho|dicha|dichos|dichas|aquel|aquella)\s+\p{L}/iu.test(s.text)
      || /\b(lo anterior|los anteriores|las anteriores|mencionad[oa]s? (anteriormente|antes)|ya mencionad[oa]s?|citad[oa]s? anteriormente)\b/i.test(s.text);
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
  let t = `El apunte dice: “${f.text}”`;
  if (f.anaphoric && f.ctx?.before) t = `El apunte dice: “${f.ctx.before} ${f.text}”`;
  return `${t}\nFuente: «${f.doc}» · ${f.loc}.`;
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

// Nombre propio compuesto de un texto («Comité de Salvación Pública»); la primera palabra sola no cuenta.
function nameChain(text) {
  const w = text.replace(/[,;:.()«»"]/g, " ").split(/\s+/).filter(Boolean), chains = [];
  for (let i = 0; i < w.length; i++) {
    if (!isCap(w[i])) continue;
    let j = i + 1;
    while (j < w.length && (isCap(w[j]) || (/^(de|del|la|las|los|y)$/i.test(w[j]) && isCap(w[j + 1] || "")))) j++;
    const c = w.slice(i, j);
    if (i > 0 || c.length > 1) chains.push(c.join(" "));
    i = j - 1;
  }
  return chains.sort((a, b) => b.length - a.length)[0] || "";
}
// Frase nominal de un texto: nombre propio compuesto, o «el agua del planeta», o la primera idea clave.
function nounPhrase(text) {
  const c = nameChain(text);
  if (c.split(" ").length > 1) return c;
  const m = text.match(/\b(?:el|la|los|las|del|al)\s+(\p{L}{4,})(?:\s+(de|del)\s+(?:(la|los|las|el)\s+)?(\p{L}{4,}))?/iu);
  if (m && !isStop(m[1]) && !VERB_WORDS.has(normalize(m[1]))) return ucFirst([m[1], m[2], m[3], m[4]].filter(Boolean).join(" "));
  return c || ucFirst(keyIdeas(text, 1)[0] || "");
}
/** ¿El subtema delata la respuesta? (en selección y completar no puede nombrarla). */
function revealsAnswer(q) {
  if (!q.focus) return false;
  const ans = (q.type === "multiple_choice" ? [q.options?.[q.answerIndex]] : q.type === "fill_blank" ? (q.answers || []).flat() : []).filter(Boolean).map(String);
  return ans.some((a) => contentWords(a).length && (overlaps(a, q.focus) || normalize(q.focus).includes(normalize(a))));
}
// Frase nominal corta para usar como subtema: «está formado por microtúbulos, microfilamentos…» → «Microtúbulos, microfilamentos y filamentos».
function shortPhrase(t, n = 6, pred = false) {
  const LEADING = /^(no|se|lo|le|les|que|por|de|del|en|con|a|al|entre|para|el|la|los|las|un|una|unos|unas|muy|más|tan|solo)$/i;
  const verbish = (w) => VERB_WORDS.has(normalize(w)) || /(?:ado|ada|ados|adas|ido|ida|idos|idas|aba|aban|ía|ían|ó|aron|ieron)$/i.test(w);
  let w = String(t).replace(/[«»"“”]/g, "").replace(new RegExp(BLANK, "g"), " ").split(/\s+/).filter(Boolean);
  if (pred && w.length > 2) w.shift();
  while (w.length > 2 && (LEADING.test(bare(w[0])) || verbish(bare(w[0])))) w.shift();
  const out = [];
  for (const x of w) { if (out.length && (/^que$/i.test(bare(x)) || verbish(bare(x)))) break; out.push(x); if (out.length >= n || /[.;:]$/.test(x)) break; }
  while (out.length > 1 && (isStop(bare(out[out.length - 1])) || /,$/.test(out[out.length - 1]) && out.length > 2 && isStop(bare(out[out.length - 2])))) out.pop();
  const res = out.join(" ").replace(/[,;:.]+$/, "");
  // Una cifra suelta («1839 por…») no nombra un tema: se usan las ideas clave del texto.
  if (!res || /^\d/.test(res)) return nounPhrase(t);
  return ucFirst(res);
}
/** Si el subtema delata la respuesta, se cambia por una idea del enunciado que no la nombra. */
function safeFocus(q) {
  return revealsAnswer(q) ? { ...q, focus: "" } : q;
}

/** Revisión final de sentido: descarta preguntas mal formadas, venga de la IA o de las reglas. */
function saneQuestion(q) {
  if (!q || !q.prompt || q.prompt.replace(new RegExp(BLANK, "g"), "").trim().length < 12) return false;
  const p = q.prompt;
  // Completa: sin cortes («…», «...») y con comillas y paréntesis cerrados.
  if (/…|\.\.\./.test(p) || (p.match(/«/g) || []).length !== (p.match(/»/g) || []).length || (p.match(/\(/g) || []).length !== (p.match(/\)/g) || []).length) return false;
  const shown = normalize(p.split(BLANK).join(" "));
  const visible = (a) => { const n = normalize(a); return n.length >= 4 && new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(shown); };
  if (q.type === "multiple_choice") {
    const n = (q.options || []).map(normalize);
    if (n.length < 3 || n.some((x) => !x) || new Set(n).size !== n.length || !(q.answerIndex >= 0 && q.answerIndex < n.length)) return false;
    // Opciones del mismo tipo: todas cifras o ninguna; y la correcta no puede leerse ya en el enunciado.
    const num = n.map((x) => /^\d+([.,]\d+)?$/.test(x));
    if (num.some((x) => x !== num[q.answerIndex])) return false;
    if (!num[q.answerIndex] && visible(q.options[q.answerIndex])) return false;
  }
  if (q.type === "true_false" && (p.includes(BLANK) || p.replace(/^Contexto:[^\n]*\n/, "").trim().length < 20)) return false;
  if (q.type === "fill_blank") {
    const blanks = p.split(BLANK).length - 1;
    if (!blanks || blanks !== q.answers.length) return false;
    if (q.answers.some((v) => !v.length || v.every((x) => isStop(x) || normalize(x).length < 2))) return false;
    // La respuesta no puede aparecer escrita en el resto de la oración.
    if (q.answers.some((v) => !/^\d/.test(v[0]) && visible(v[0]))) return false;
  }
  if (q.type === "open" && (!q.modelAnswer || q.modelAnswer.length < 20)) return false;
  return true;
}

// Clase de elemento que enumera un apartado («Pasos para la entrevista» → «paso»), para redactar preguntas precisas.
const KINDS = {
  pasos: ["paso", "m"], etapas: ["etapa", "f"], fases: ["fase", "f"], tipos: ["tipo", "m"], periodos: ["período", "m"],
  tecnicas: ["técnica", "f"], caracteristicas: ["característica", "f"], criterios: ["criterio", "m"], funciones: ["función", "f"],
  factores: ["factor", "m"], elementos: ["elemento", "m"], niveles: ["nivel", "m"], modelos: ["modelo", "m"], teorias: ["teoría", "f"],
  enfoques: ["enfoque", "m"], principios: ["principio", "m"], metodos: ["método", "m"], componentes: ["componente", "m"],
  dimensiones: ["dimensión", "f"], areas: ["área", "f"], momentos: ["momento", "m"], escuelas: ["escuela", "f"], corrientes: ["corriente", "f"],
  instrumentos: ["instrumento", "m"], pruebas: ["prueba", "f"], tests: ["test", "m"], trastornos: ["trastorno", "m"], sintomas: ["síntoma", "m"],
  causas: ["causa", "f"], consecuencias: ["consecuencia", "f"], ventajas: ["ventaja", "f"], objetivos: ["objetivo", "m"], partes: ["parte", "f"],
  procesos: ["proceso", "m"], estrategias: ["estrategia", "f"], habilidades: ["habilidad", "f"], ejes: ["eje", "m"], estadios: ["estadio", "m"],
};
function termKind(f) {
  if (f.term?.person) return { n: "autor", g: "m" };
  const hit = normalize(f.topic).split(" ").map((w) => KINDS[w]).find(Boolean) || (f.term?.refs ? ["enfoque", "m"] : ["concepto", "m"]);
  return { n: hit[0], g: hit[1] };
}
const art = (k, cap = false) => (k.g === "f" ? (cap ? "La" : "la") : cap ? "El" : "el");
// «comprende: trastornos…» para listas; «consiste en: describir…» para acciones.
const linkVerb = (desc) => (/^\p{Ll}+(ar|er|ir)\b/u.test(desc) ? "consiste en" : "comprende");
// Descripción que es una oración («se comunican los resultados…»): se redacta «en el que…».
const isClause = (desc) => /^(se|no|le|les|lo|la)\s/i.test(desc);
// Si el nombre ya dice la clase («Período psicométrico»), no se repite («el período «Período psicométrico»»).
const hasKind = (f, k) => normalize(f.term.name).split(" ").includes(normalize(k.n));
const termNP = (f) => { const k = termKind(f); return hasKind(f, k) ? `«${f.term.name}»` : `${art(k)} ${k.n} «${f.term.name}»`; };
/** Afirmación completa de una entrada de esquema: «El paso «Diagnóstico» comprende: …», «Los autores asociados al «…» son: …». */
function termStmt(f, desc) {
  const t = f.term;
  if (t.refs) return contract(`Los autores asociados a ${termNP(f)} son: ${desc}.`);
  if (t.person) return `${t.name} se asocia con la idea: «${desc}».`;
  if (isClause(desc)) return `En ${termNP(f)} ${desc}.`;
  return `${ucFirst(termNP(f))} ${linkVerb(desc)}: ${desc}.`;
}
// Texto de un hecho como afirmación (las entradas de esquema se redactan completas).
const stmt = (f) => (f.term ? termStmt(f, f.term.desc) : f.text);

/**
 * Motor demo: elige hechos repartidos por todos los apartados (sin repetir lo ya preguntado en la sesión)
 * y construye preguntas distintas según el nivel:
 *  Fácil — definiciones y datos literales, distractores de otros temas.
 *  Medio — identificar conceptos por su descripción, palabras clave, falsas con un concepto relacionado.
 *  Difícil (POVEDA) — «¿cuál es correcta?», cifras y nombres exactos, dos huecos, relaciones entre conceptos.
 *  Jacqueline — «¿cuál es INCORRECTA?», afirmaciones compuestas, tres huecos y comparaciones entre temas o documentos.
 */
function generateLocal(files, cfg, history = {}) {
  const facts = buildFacts(files);
  const withSubj = facts.filter((f) => f.subj);
  const terms = facts.filter((f) => f.term);
  if (!withSubj.length && !terms.length && !facts.some((f) => f.numbers.length))
    throw new Error("El modo demo no encontró suficientes oraciones completas en tus documentos. Funciona mejor con Word, PDF o archivos de texto con párrafos redactados; para fotos, esquemas o apuntes a mano usa With Gemini.");
  const d = cfg.difficulty, hard = d === "hard" || d === "jacqueline";
  const nOpts = d === "jacqueline" ? 5 : 4;
  const sentences = new Set(facts.map((f) => normalize(f.text)));
  const factKey = (f) => normalize(f.text).slice(0, 140);
  const prevFacts = new Set(history.facts || []);
  const prevPrompts = new Set((history.prompts || []).map(normalize));

  const optionsWith = (right, others) => {
    const pool = [...new Set(others.map(ucFirst))].filter((x) => normalize(x) !== normalize(right));
    return pool.length >= 2 ? shuffle([ucFirst(right), ...pool.slice(0, nOpts - 1)]) : null;
  };
  // Ficha de un concepto: sus oraciones del mismo documento (respuesta modelo de las abiertas).
  const card = (f) => {
    if (f.term) return `${f.term.label}: ${f.term.desc}.`;
    const mine = withSubj.filter((x) => x.fi === f.fi && sameConcept(x, f));
    const exact = (x) => normalize(x.subj.noun) === normalize(f.subj.noun);
    return [f, ...mine.filter((x) => x !== f && exact(x)), ...mine.filter((x) => !exact(x))].map((x) => x.text).slice(0, 3).join(" ");
  };
  // Conceptos comparables del mismo documento; «near» = mismo tema primero (más difícil), «far» = otros temas primero (más fácil).
  const peers = (f, { defs = false, order = hard ? "near" : "any" } = {}) => {
    const seen = new Set([normalize(f.subj.noun)]), picked = [];
    const list = withSubj.filter((x) => x.fi === f.fi && !sameConcept(x, f) && sameShape(x, f) && (!defs || x.subj.def) && !normalize(f.text).includes(normalize(x.subj.noun)));
    const same = shuffle(list.filter((x) => x.topic === f.topic)), other = shuffle(list.filter((x) => x.topic !== f.topic));
    const ordered = order === "near" ? [...same, ...other] : order === "far" ? [...other, ...same] : shuffle(list);
    return ordered.filter((x) => { const k = normalize(x.subj.noun); if (seen.has(k) || picked.some((y) => overlaps(y, x.subj.noun))) return false; seen.add(k); picked.push(x.subj.noun); return true; });
  };
  const termPeers = (f) => {
    const list = terms.filter((x) => x.fi === f.fi && x.id !== f.id && !x.term.generic && x.term.refs === f.term.refs && x.term.person === f.term.person
      && !overlaps(x.term.label, f.term.label) && normalize(x.term.desc) !== normalize(f.term.desc));
    return [...shuffle(list.filter((x) => x.topic === f.topic)), ...shuffle(list.filter((x) => x.topic !== f.topic))];
  };
  const focusOf = (f) => {
    const t = f.term ? f.term.name : f.subj ? ucFirst(f.subj.npText) : nounPhrase(f.text);
    return t && normalize(t) !== normalize(f.topic) ? ucFirst(t) : "";
  };
  const base = (f, type) => ({ id: uid(), type, topic: f.topic, focus: focusOf(f), fact: factKey(f), explanation: cite(f), source: { doc: f.doc, loc: f.loc } });

  // Formas de convertir un hecho en una afirmación falsa pero plausible (cada una con su porqué).
  const falsesOf = (f, mode = "any") => {
    const out = [];
    if (f.term && !f.term.generic) {
      const pick = termPeers(f)[0];
      if (pick) out.push({ text: termStmt(f, pick.term.desc), focus: f.term.name, why: `Eso corresponde a «${pick.term.name}». Lo correcto es: ${termStmt(f, f.term.desc)}` });
      return out;
    }
    if (f.numbers.length) {
      const n = f.numbers[0], v = numericVariants(n, f.numbers)[0];
      if (v) out.push({ kind: "num", text: replaceOnce(f.text, n, v), why: `El dato correcto es ${n}, no ${v}.` });
    }
    if (f.subj) {
      const mine = new Set(contentWords(f.subj.pred));
      const related = (x) => contentWords(x.subj.pred).filter((w) => mine.has(w)).length + (normalize(x.subj.noun.split(" ")[0]) === normalize(f.subj.noun.split(" ")[0]) ? 2 : 0) + (x.topic === f.topic ? 1 : 0);
      // Solo conceptos relacionados (comparten ideas, núcleo o tema): la falsa debe ser plausible, nunca absurda.
      const pool = peers(f, { order: mode === "easy" ? "far" : "near" }).map((x) => ({ x, r: related(x) })).filter((p) => p.r >= 2).sort((a, b) => b.r - a.r);
      const pick = pool[0]?.x;
      if (pick) out.push({ kind: "swap", text: swapSubject(f, pick), focus: ucFirst(npLower(pick.subj)), why: contract(`El apunte atribuye esto a ${npLower(f.subj)}, no a ${npLower(pick.subj)}.`) });
      if (f.subj.def) out.push({ kind: "neg", text: replaceOnce(f.text, ` ${f.subj.copula} `, ` no ${f.subj.copula} `), why: `El apunte afirma justo lo contrario.` });
    }
    if (/\bno\s+(es|son|tiene|tienen|requiere|requieren|puede|pueden|presenta|presentan)\b/.test(f.text) && !/\bsí\b/i.test(f.text))
      out.push({ kind: "neg", text: f.text.replace(/\bno\s+/, ""), why: `El apunte dice justo lo contrario.` });
    return out.filter((x) => !sentences.has(normalize(x.text)) && x.text !== f.text);
  };
  const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  // Fuente citada al inicio («Según Endara (1987), …» → «Endara (1987)»), para preguntar «¿Qué afirma Endara (1987) sobre…?».
  const sourceOf = (s) => (s.prefix.match(/^según\s+(.+?),\s*$/i) || [])[1] || "";
  // Qué se espera en el hueco del sujeto: un concepto o el nombre de una persona.
  const subjHint = (f) => (f.subj?.proper && !f.subj.det ? "autor o nombre" : "concepto");
  // Palabra clave del predicado (no el sujeto) para huecos de nivel medio en adelante.
  const keyword = (f) => {
    if (!f.subj) return null;
    const skip = normalize(f.subj.noun);
    // Sin nombres propios sueltos («Hermann» de «Hermann Rorschach»): el hueco debe ser una palabra con sentido propio.
    return keyIdeas(f.subj.pred, 6, f.subj.noun).filter((w) => w.length >= 5 && !/\d/.test(w) && !isCap(w) && !VERB_WORDS.has(normalize(w)) && !skip.includes(normalize(w)))[Math.random() < 0.5 ? 0 : 1] || null;
  };

  const variants = {
    multiple_choice: {
      def(f) {
        if (!f.subj?.def) return null;
        const opts = optionsWith(f.subj.def, peers(f, { defs: true, order: d === "easy" ? "far" : "near" }).map((x) => x.subj.def));
        return opts && { ...base(f, "multiple_choice"), prompt: `¿Qué ${f.subj.copula} ${npLower(f.subj)}?`, options: opts, answerIndex: opts.indexOf(ucFirst(f.subj.def)),
          explanation: `La respuesta correcta es: ${lc(f.subj.def)}.\n${cite(f)}` };
      },
      concept(f) {
        if (!f.subj) return null;
        const opts = optionsWith(f.subj.npText, peers(f, { order: d === "easy" ? "far" : "near" }).map((x) => x.subj.npText));
        if (!opts) return null;
        const stem = f.subj.prefix ? `${f.subj.prefix}${BLANK} ${f.subj.pred}` : `${BLANK} ${f.subj.pred}`;
        return { ...base(f, "multiple_choice"), prompt: `${lead(f)}¿Qué ${f.subj.proper && !f.subj.det ? "autor o personaje" : "concepto"} completa correctamente esta afirmación?\n«${stem}»`, options: opts, answerIndex: opts.indexOf(ucFirst(f.subj.npText)),
          explanation: `La respuesta correcta es «${f.subj.npText}».\n${cite(f)}` };
      },
      termLabel(f) {
        if (!f.term || f.term.generic) return null;
        const k = termKind(f), opts = optionsWith(f.term.name, termPeers(f).map((x) => x.term.name));
        if (!opts) return null;
        const prompt = f.term.refs ? `¿A qué ${k.n} corresponden estos autores?\n«${f.term.desc}»`
          : f.term.person ? `¿Qué autor se asocia con esta idea?\n«${f.term.desc}»`
          : isClause(f.term.desc) ? `¿En qué ${k.n} ${f.term.desc}?`
          : `¿Qué ${k.n} ${linkVerb(f.term.desc)} lo siguiente?\n«${f.term.desc}»`;
        return { ...base(f, "multiple_choice"), prompt, options: opts, answerIndex: opts.indexOf(ucFirst(f.term.name)), explanation: `La respuesta correcta es «${f.term.name}».\n${cite(f)}` };
      },
      termDesc(f) {
        if (!f.term || f.term.generic || f.term.desc.length > 150) return null;
        const k = termKind(f), others = termPeers(f).filter((x) => x.term.desc.length <= 150).map((x) => x.term.desc);
        const opts = optionsWith(f.term.desc, others);
        if (!opts) return null;
        const prompt = f.term.refs ? contract(`¿Qué autores se asocian a ${termNP(f)}?`)
          : f.term.person ? `¿Con qué idea se asocia a ${f.term.name}?` : isClause(f.term.desc) ? `¿Qué ocurre en ${termNP(f)}?` : `¿Qué ${linkVerb(f.term.desc)} ${termNP(f)}?`;
        return { ...base(f, "multiple_choice"), prompt, options: opts, answerIndex: opts.indexOf(ucFirst(f.term.desc)), explanation: `La respuesta correcta es: ${f.term.desc}.\n${cite(f)}` };
      },
      number(f) {
        if (!f.numbers.length) return null;
        const n = f.numbers[f.numbers.length > 1 && d === "jacqueline" ? 1 : 0];
        const vars = numericVariants(n, f.numbers).slice(0, nOpts - 1);
        if (vars.length < nOpts - 1) return null;
        const opts = shuffle([n, ...vars]);
        return { ...base(f, "multiple_choice"), prompt: `${lead(f)}¿Qué dato exacto completa esta afirmación?\n«${replaceOnce(f.text, n, BLANK)}»`, options: opts, answerIndex: opts.indexOf(n),
          explanation: `El dato correcto es ${n}.\n${cite(f)}` };
      },
      // Difícil: una sola afirmación correcta entre versiones alteradas de otros hechos del mismo documento.
      correctStatement(f) {
        if (f.anaphoric || f.text.length > 230) return null;
        const pool = shuffle(facts.filter((g) => g.fi === f.fi && g.id !== f.id && !g.anaphoric && g.text.length <= 230)).sort((a, b) => (b.topic === f.topic) - (a.topic === f.topic));
        const wrong = [], whys = [];
        for (const g of pool) { const x = falsesOf(g)[0]; if (x && !wrong.includes(x.text)) { wrong.push(x.text); whys.push(`• “${stripEnd(x.text)}”: ${x.why}`); } if (wrong.length >= nOpts - 1) break; }
        if (wrong.length < 2) return null;
        const opts = shuffle([stmt(f), ...wrong]);
        return { ...base(f, "multiple_choice"), focus: "", prompt: "¿Cuál de las siguientes afirmaciones es correcta?", options: opts, answerIndex: opts.indexOf(stmt(f)),
          explanation: `La correcta es: “${stripEnd(stmt(f))}”.\nLas demás alteran el apunte:\n${whys.join("\n")}\nFuente: «${f.doc}» · ${f.loc}.` };
      },
      // Jacqueline: la única afirmación INCORRECTA entre hechos verdaderos de otros temas o documentos.
      incorrectStatement(f) {
        const x = falsesOf(f)[0];
        if (!x || f.anaphoric || f.text.length > 230) return null;
        const pool = shuffle(facts.filter((g) => g.id !== f.id && !g.anaphoric && g.text.length <= 230 && (g.topic !== f.topic || g.fi !== f.fi)));
        const trues = []; const seenT = new Set([f.topic]);
        for (const g of pool) { if (seenT.has(g.topic) && trues.length < 2) continue; trues.push(stmt(g)); seenT.add(g.topic); if (trues.length >= nOpts - 1) break; }
        if (trues.length < 2) return null;
        const opts = shuffle([x.text, ...trues]);
        return { ...base(f, "multiple_choice"), focus: "Afirmaciones de varios temas", prompt: "¿Cuál de las siguientes afirmaciones es INCORRECTA?", options: opts, answerIndex: opts.indexOf(x.text),
          explanation: `La incorrecta es: “${stripEnd(x.text)}”. ${x.why} Las demás coinciden con el apunte.\n${cite(f)}` };
      },
    },

    true_false: {
      plain(f, mode) {
        if (f.term?.generic) return null;
        const b = base(f, "true_false"), fs = falsesOf(f, mode);
        // Fácil: negación clara; medio: concepto relacionado cambiado; difícil: cifra exacta o matiz.
        const x = mode === "easy" ? fs.find((y) => y.kind === "neg") || fs[0]
          : mode === "related" ? fs.find((y) => y.kind === "swap") || fs[0]
          : fs.find((y) => y.kind === "num") || fs.find((y) => y.kind === "swap") || fs[0];
        if (!x || Math.random() < 0.45) {
          if (!f.subj && !f.numbers.length && !f.term) return null;
          return { ...b, prompt: lead(f) + stmt(f), answerBool: true, explanation: `Es verdadera.\n${cite(f)}` };
        }
        return { ...b, ...(x.focus ? { focus: x.focus } : {}), prompt: lead(f) + x.text, answerBool: false, explanation: `Es falsa. ${x.why}\n${cite(f)}` };
      },
      easy(f) { return this.plain(f, "easy"); },
      related(f) { return this.plain(f, "related"); },
      subtle(f) { return this.plain(f, "subtle"); },
      // Jacqueline: dos afirmaciones de temas distintos unidas; basta que una esté alterada para que sea falsa.
      compound(f) {
        if (f.anaphoric || f.term) return null;
        const others = shuffle(facts.filter((x) => x.id !== f.id && !x.anaphoric && !x.term && x.topic !== f.topic && x.text.length < 200));
        const g = others.find((x) => x.fi === f.fi) || others[0];
        if (!g || f.text.length > 200) return null;
        const alter = Math.random() < 0.55, target = Math.random() < 0.5 ? f : g, x = alter ? falsesOf(target)[0] : null;
        const A = x && target === f ? x.text : f.text, B = x && target === g ? x.text : g.text;
        return { ...base(f, "true_false"), focus: `${focusOf(f) || f.topic} y ${focusOf(g) || g.topic}`, prompt: `${stripEnd(A)}; además, ${lc(B)}`, answerBool: !x,
          explanation: x ? `Es falsa: una de las dos partes está alterada. ${x.why}\n${cite(target)}` : `Es verdadera: las dos partes coinciden con el apunte.\n${cite(f)}\n${cite(g)}` };
      },
    },

    fill_blank: {
      subject(f) {
        if (!f.subj) return null;
        return { ...base(f, "fill_blank"), prompt: lead(f) + replaceOnce(f.text, f.subj.noun, BLANK), answers: [[...new Set([f.subj.noun, f.subj.npText])]], hints: [subjHint(f)],
          explanation: `La respuesta es «${f.subj.noun}».\n${cite(f)}` };
      },
      term(f) {
        if (!f.term || f.term.generic) return null;
        const k = termKind(f), t = f.term;
        const prompt = t.refs ? (hasKind(f, k) ? `Los autores ${t.desc} se asocian a ${BLANK}.` : contract(`Los autores ${t.desc} se asocian a ${art(k)} ${k.n} ${BLANK}.`))
          : t.person ? `La idea «${t.desc}» se asocia con el autor ${BLANK}.`
          : isClause(t.desc) ? `${art(k, true)} ${k.n} en ${k.g === "f" ? "la" : "el"} que ${t.desc} se llama ${BLANK}.`
          : `${art(k, true)} ${k.n} que ${linkVerb(t.desc)} «${t.desc}» se llama ${BLANK}.`;
        return { ...base(f, "fill_blank"), prompt, answers: [[...new Set([t.name, t.label])]], hints: [t.person ? "autor" : `nombre del ${k.n}`], explanation: `La respuesta es «${t.name}».\n${cite(f)}` };
      },
      keyword(f) {
        const w = keyword(f);
        if (!w || !f.text.includes(w)) return null;
        const i = f.text.indexOf(w, f.text.indexOf(f.subj.noun) + f.subj.noun.length);
        if (i < 0) return null;
        return { ...base(f, "fill_blank"), prompt: lead(f) + f.text.slice(0, i) + BLANK + f.text.slice(i + w.length), answers: [[w]], hints: ["palabra clave"], explanation: `La palabra que falta es «${w}».\n${cite(f)}` };
      },
      number(f) {
        if (!f.numbers.length) return null;
        const n = f.numbers[0];
        return { ...base(f, "fill_blank"), prompt: lead(f) + replaceOnce(f.text, n, BLANK), answers: [[n]], hints: ["cifra"], explanation: `El dato que falta es ${n}.\n${cite(f)}` };
      },
      // Difícil: el concepto y un dato (cifra o palabra clave) a la vez.
      twoBlank(f) {
        if (f.term && f.term.refs && !f.term.generic) {
          const who = refNames(f.term.desc)[0], k = termKind(f);
          if (!who) return null;
          return { ...base(f, "fill_blank"), prompt: hasKind(f, k) ? `Los autores ${replaceOnce(f.term.desc, who, BLANK)} se asocian a ${BLANK}.` : contract(`Los autores ${replaceOnce(f.term.desc, who, BLANK)} se asocian a ${art(k)} ${k.n} ${BLANK}.`), answers: [[who], [...new Set([f.term.name, f.term.label])]], hints: ["autor", `nombre del ${k.n}`],
            explanation: `Respuestas: «${who}» y «${f.term.name}».\n${cite(f)}` };
        }
        if (!f.subj || f.subj.proper) return null;
        const second = f.numbers[0] || keyword(f);
        if (!second) return null;
        let prompt = replaceOnce(f.text, f.subj.noun, BLANK);
        if (!prompt.includes(second)) return null;
        prompt = replaceOnce(prompt, second, BLANK);
        return { ...base(f, "fill_blank"), prompt: lead(f) + prompt, answers: [[...new Set([f.subj.noun, f.subj.npText])], [second]], hints: [subjHint(f), /^\d/.test(second) ? "cifra" : "palabra clave"], explanation: `Respuestas: «${f.subj.noun}» y «${second}».\n${cite(f)}` };
      },
      // Jacqueline: tres huecos (concepto, cifra y palabra clave).
      threeBlank(f) {
        if (!f.subj || f.subj.proper || !f.numbers.length) return null;
        const w = keyword(f), n = f.numbers[0];
        if (!w || normalize(w) === normalize(n)) return null;
        const marks = [[f.subj.noun, [...new Set([f.subj.noun, f.subj.npText])], subjHint(f)], [n, [n], "cifra"], [w, [w], "palabra clave"]]
          .map(([t, ans, hint]) => ({ t, ans, hint, i: f.text.indexOf(t) })).filter((m) => m.i >= 0).sort((a, b) => a.i - b.i);
        if (marks.length < 3 || marks[1].i < marks[0].i + marks[0].t.length || marks[2].i < marks[1].i + marks[1].t.length) return null;
        let prompt = "", at = 0;
        for (const m of marks) { prompt += f.text.slice(at, m.i) + BLANK; at = m.i + m.t.length; }
        prompt += f.text.slice(at);
        return { ...base(f, "fill_blank"), prompt: lead(f) + prompt, answers: marks.map((m) => m.ans), hints: marks.map((m) => m.hint), explanation: `Respuestas: ${marks.map((m) => `«${m.t}»`).join(", ")}.\n${cite(f)}` };
      },
    },

    open: {
      define(f) {
        if (f.term) {
          const t = f.term, k = termKind(f);
          const prompt = t.refs ? contract(`¿Qué autores se asocian a ${termNP(f)}?`)
            : t.generic ? `¿Qué se plantea como «${t.label.toLowerCase()}» en «${f.topic}»?`
            : t.person ? `¿Qué idea se asocia con ${t.name}?` : isClause(t.desc) ? `¿Qué ocurre en ${termNP(f)}?` : `¿Qué ${linkVerb(t.desc)} ${termNP(f)}? Explícalo con los elementos que menciona el apunte.`;
          const kp = t.refs ? refNames(t.desc).slice(0, 4) : keyIdeas(t.desc, 4);
          return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
        }
        if (!f.subj) return null;
        const s = f.subj, np = npLower(s);
        const src = sourceOf(s);
        const prompt = s.def ? `¿Qué ${s.copula} ${np}?` : src ? `¿Qué afirma ${src} sobre ${np}?` : s.proper && !s.det && !s.prefix ? `¿Qué hizo ${np} y por qué es relevante?` : contract(`¿Qué caracteriza a ${np}${prefixPhrase(s)}?`);
        const kp = keyIdeas(card(f), 4, s.noun);
        return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
      },
      explain(f) {
        if (!f.subj) return this.define(f);
        const s = f.subj, np = npLower(s);
        const prompt = s.def ? `Explica con tus palabras qué ${s.copula} ${np} y qué características ${s.plural ? "tienen" : "tiene"}.`
          : sourceOf(s) ? `Explica qué afirma ${sourceOf(s)} sobre ${np} y qué datos concretos aporta.`
          : `Explica qué se sabe de ${np}${prefixPhrase(s)} y menciona los datos concretos que aporta el apunte.`;
        const kp = keyIdeas(card(f), 4, s.noun);
        return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
      },
      // Difícil: relacionar dos conceptos del mismo tema.
      relate(f, across = false) {
        if (f.term && !f.term.generic) {
          const pair = termPeers(f).find((x) => (across ? x.topic !== f.topic : x.topic === f.topic));
          if (!pair) return null;
          const k = termKind(f), t = f.term;
          const prompt = t.refs ? `¿Qué autores corresponden a «${t.name}» y cuáles a «${pair.term.name}»? Explica en qué se diferencian.`
            : t.person ? `¿Con qué idea se asocia a ${t.name} y con cuál a ${pair.term.name}? Compáralas.`
            : `Compara ${termNP(f)} con «${pair.term.name}»: ¿qué ${linkVerb(t.desc)} cada uno y en qué se diferencian?`;
          return { ...base(f, "open"), focus: `${t.name} y ${pair.term.name}`, prompt, modelAnswer: `${card(f)}\n${card(pair)}`,
            keyPoints: t.refs ? [...refNames(t.desc).slice(0, 2), ...refNames(pair.term.desc).slice(0, 2)] : [...keyIdeas(t.desc, 2), ...keyIdeas(pair.term.desc, 2)], explanation: `${cite(f)}\n${cite(pair)}` };
        }
        if (!f.subj || f.subj.prefix) return null;
        const s = f.subj, np = npLower(s), headWord = normalize(s.noun.split(" ")[0]);
        const cands = shuffle(withSubj.filter((x) => !x.subj.prefix && !sameConcept(x, f) && (across ? x.topic !== f.topic : x.fi === f.fi && x.topic === f.topic)));
        const pair = cands.find((x) => normalize(x.subj.noun.split(" ")[0]) === headWord) || cands[0];
        if (!pair) return null;
        const other = npLower(pair.subj), comparable = normalize(pair.subj.noun.split(" ")[0]) === headWord;
        const prompt = across
          ? `Relaciona ${np} (${f.topic}) con ${other} (${pair.topic}): ¿qué los conecta y en qué se diferencian? Apóyate en los datos del apunte.`
          : comparable ? `Compara ${np} y ${other}: ¿en qué se parecen y en qué se diferencian?` : `¿Qué relación hay entre ${np} y ${other}? Explícala con datos concretos.`;
        return { ...base(f, "open"), focus: `${ucFirst(np)} y ${other}`, prompt, modelAnswer: `${card(f)}\n\n${card(pair)}`,
          keyPoints: [...new Set([...keyIdeas(s.pred, 2, s.noun), ...keyIdeas(pair.subj.pred, 2, pair.subj.noun)])], explanation: `${cite(f)}\n${cite(pair)}` };
      },
      across(f) { return this.relate(f, true); },
    },
  };

  // Qué variantes usa cada nivel, por tipo, en orden de preferencia (se baraja un poco para variar).
  const PLAN = {
    easy: { multiple_choice: ["def", "termLabel", "concept"], true_false: ["easy"], fill_blank: ["subject", "term"], open: ["define"] },
    medium: { multiple_choice: ["concept", "termLabel", "termDesc", "def"], true_false: ["related"], fill_blank: ["keyword", "term", "subject"], open: ["explain", "define"] },
    hard: { multiple_choice: ["correctStatement", "number", "termDesc", "concept"], true_false: ["subtle"], fill_blank: ["twoBlank", "number", "keyword"], open: ["relate", "explain"] },
    jacqueline: { multiple_choice: ["incorrectStatement", "correctStatement", "number"], true_false: ["compound", "subtle"], fill_blank: ["threeBlank", "twoBlank", "number"], open: ["across", "relate"] },
  }[d];
  // Afinidad de cada hecho con el nivel: fácil → definiciones; difícil → cifras, nombres y oraciones largas.
  const weight = (f) => (d === "easy" ? (f.subj?.def ? 3 : f.term && !f.term.refs ? 2 : f.subj || f.term ? 1 : 0) - f.text.length / 250
    : d === "medium" ? (f.subj ? 1.5 : f.term ? 1.2 : 0.3)
    : (f.numbers.length ? 2 : 0) + (f.term?.refs || f.subj?.proper ? 1 : 0) + (f.subj || f.term ? 1 : 0) + f.text.length / 200);

  const topicKey = (f) => f.fi + "|" + f.topic;
  const byTopic = new Map();
  for (const f of facts) { const k = topicKey(f); if (!byTopic.has(k)) byTopic.set(k, []); byTopic.get(k).push(f); }
  const topicUse = new Map([...byTopic.keys()].map((k) => [k, 0]));
  const usedHere = new Map(); // hecho → tipos usados en este test
  const questions = [];
  for (const type of distribute(cfg.modes, cfg.count)) {
    let made = null;
    // Temas menos usados primero (y al azar entre iguales): el test recorre todo el documento.
    const topicOrder = shuffle([...byTopic.keys()]).sort((a, b) => topicUse.get(a) - topicUse.get(b));
    const vlist = PLAN[type].slice(0, 1).concat(shuffle(PLAN[type].slice(1)));
    for (const tk of topicOrder) {
      // Dentro del tema: primero lo no preguntado antes en la sesión, luego afinidad con el nivel + azar.
      const cands = byTopic.get(tk).filter((f) => !(usedHere.get(f.id) || []).includes(type) && (usedHere.get(f.id) || []).length < 2)
        .map((f) => ({ f, s: (prevFacts.has(factKey(f)) ? -6 : 0) - (usedHere.has(f.id) ? 3 : 0) + weight(f) + Math.random() * 2.5 }))
        .sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.f);
      for (const f of cands) {
        for (const v of Math.random() < 0.7 ? vlist : shuffle(vlist)) {
          const q = variants[type][v]?.call(variants[type], f);
          if (!q || !saneQuestion(q) || questions.some((x) => x.prompt === q.prompt) || prevPrompts.has(normalize(cleanPrompt(q.prompt)))) continue;
          if (revealsAnswer(q)) {
            const alts = f.term ? [f.term.refs ? `Autores: ${refNames(f.term.desc).slice(0, 3).join(", ")}` : shortPhrase(f.term.desc)]
              : [f.subj?.def && shortPhrase(f.subj.def), f.subj && shortPhrase(f.subj.pred, 6, true), nameChain(f.text)];
            q.focus = alts.filter(Boolean).find((c) => c.split(" ").length > 1 && !revealsAnswer({ ...q, focus: c })) || "";
          }
          made = q; usedHere.set(f.id, [...(usedHere.get(f.id) || []), type]); topicUse.set(tk, topicUse.get(tk) + 1);
          break;
        }
        if (made) break;
      }
      if (made) break;
    }
    if (made) questions.push(made);
  }
  if (!questions.length) throw new Error("No se pudieron generar preguntas con este material en modo demo: tiene muy pocas oraciones completas. Prueba con documentos Word, PDF o de texto con párrafos completos, o usa With Gemini.");
  return { questions: shuffle(questions.map((q) => safeFocus({ ...q, prompt: ucFirst(cleanPrompt(q.prompt)) }))), coverage: 100 };
}
