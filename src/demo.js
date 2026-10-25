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
  if (t.length < 3 || t.length > 90 || /[.;,]$/.test(line.trim())) return false;
  // Palabras sin contar la numeración ni los paréntesis («1. Definiciones y objeto de estudio (págs. 4-5)»).
  const core = t.replace(/\s*\([^)]*\)/g, "").replace(/^(?:\d{1,2}(?:\.\d{1,2})*|[a-zA-Z]|[IVX]{1,4})[.)]\s+/, "");
  if (core.split(/\s+/).length > 9 || !/^[\p{Lu}\d¿¡]/u.test(t)) return false;
  // «Se conocen», «Muy pronto Freud se esforzó…»: empiezan como una oración, no como un título.
  if (/^(se|y|o|que|muy|pero|aunque|cuando|también|además|luego|entonces|así|ya)\s/i.test(core)) return false;
  // Un título no termina en artículo o preposición («…estandarización de sus») ni contiene otra oración («… (…). Rompe con las»).
  if (/\s(de|del|la|el|los|las|y|e|o|u|que|en|a|al|con|por|para|un|una|su|sus|se|lo|como|entre|sobre|sin|desde|hasta)$/.test(core) || /[.!?]\s+\p{Lu}/u.test(core)) return false;
  // «Primera etapa (1880-1910): pre-científica»: con dos puntos solo si es corto, sin comas ni verbos.
  if (/:\s+\S/.test(t) && !/^(unidad|tema|cap[ií]tulo|m[oó]dulo|bloque|parte|secci[oó]n|lecci[oó]n|resumen|apuntes|gu[ií]a|introducci[oó]n|repaso)\b/i.test(t)) {
    const [a, b] = core.split(/:\s*/, 2);
    if (/,/.test(t) || a.split(/\s+/).length > 4 || (b || "").split(/\s+/).length > 6 || hasVerb(core)) return false;
  }
  // Letras frente al resto de signos (sin contar espacios ni cifras: «Tema 12 (pág. 120)» sigue siendo un título).
  return (t.match(/\p{L}/gu) || []).length / Math.max(1, t.replace(/[\s\d]/g, "").length) > 0.75;
}
const BULLET = /^(?:[•\-–*·▪►]\s*|\d{1,2}[.)]\s+)/;
const JOINER = /\b(de|del|la|el|los|las|y|e|o|u|que|en|a|al|con|por|para|un|una|su|sus|se|lo|como|entre|sobre|sin|desde|hasta)$/i;

const tokens = (t) => t.match(/[\p{L}\p{N}][\p{L}\p{N}%,.\-]*[\p{L}\p{N}%]|[\p{L}\p{N}]/gu) || [];
const DET = /^(el|la|los|las|un|una|unos|unas)$/i;
const FEM_DET = /^(la|las|una|unas)$/i;
const PLURAL_DET = /^(los|las|unos|unas)$/i;
const LEAD_PREP = /^(en|durante|según|para|con|desde|tras|ante|bajo|sobre|entre|hacia|hasta|por|sin|aproximadamente|además|asimismo|finalmente|actualmente|hoy)$/i;
const VERBISH = new Set("es son fue fueron era eran sera seran esta estan estaba estaban estuvo tiene tienen tenia tuvo hay se no ha han habia habian puede pueden debe deben ya tambien solo".split(" "));
const ADJ = /(al|ales|ar|ares|ico|ica|icos|icas|ivo|iva|ivos|ivas|oso|osa|osos|osas|ble|bles|ente|entes|ante|antes|ota|otas|ario|aria|arios|arias|ano|ana|anos|anas|ino|ina|inos|inas|eo|ea|eos|eas|ular|ulares|ista|istas|ófilo|ófila|ófilos|ófilas|ego|ega|egos|egas)$/i;
const COPULA = /^(es|son|era|eran|fue|fueron)\s+(un|una|unos|unas|el|la|los|las)\s/i;
const NUM = /\b\d+(?:[.,]\d+)?\b/g;
// Sin la puntuación final, salvo en iniciales («J.C.»).
const bare = (w) => (/^(?:\p{Lu}\.){1,3}$/u.test(w) ? w : w.replace(/[,;:.]+$/, ""));
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
  if (/^(Lo|Le|Les|Se|Me|Te|Nos)$/.test(bare(words[i]))) return null;
  if (isCap(words[i])) {
    // Nombre propio: «Revolución Francesa», «Declaración de los Derechos del Hombre y del Ciudadano».
    proper = true;
    np.push(bare(words[i])); i++;
    while (i < words.length && !endsClause(words[i - 1])) {
      // «Clínico El problema…»: un artículo o preposición en mayúscula abre otra frase, no sigue el nombre.
      if (isCap(words[i]) && !/^(El|La|Los|Las|Un|Una|Unos|Unas|En|De|Del|Y|A|Al|Con|Por|Para|Se|Lo|Su|Sus|Este|Esta|Es|Son)$/.test(bare(words[i]))) { np.push(bare(words[i])); i++; continue; }
      let j = i;
      while (j < words.length && j - i < 3 && /^(de|del|la|las|los|el|y|e)$/i.test(words[j])) j++;
      if (j > i && j < words.length && isCap(words[j])) { np.push(...words.slice(i, j)); i = j; continue; }
      break;
    }
    // Una sola palabra en mayúscula al inicio solo es nombre propio si aparece así a mitad de frase.
    if (!det && np.length < 2 && !midCaps.has(normalize(np[0]))) return null;
  } else {
    // «El nuevo nombre», «La primera etapa»: el adjetivo antepuesto va con el sustantivo que le sigue.
    if (/^(nuev[oa]s?|gran|grandes|buen|buen[oa]s?|mal[oa]?s?|primer[oa]?s?|segund[oa]s?|tercer[oa]?s?|últim[oa]s?|mism[oa]s?|propi[oa]s?|principal(?:es)?|verdader[oa]s?|antigu[oa]s?|viej[oa]s?|únic[oa]s?|pequeñ[oa]s?|distint[oa]s|divers[oa]s|primordial(?:es)?)$/i.test(bare(words[i]) || "") && /^\p{Ll}{3,}$/u.test(bare(words[i + 1] || "")) && !endsClause(words[i])) { np.push(bare(words[i])); i++; }
    const head = bare(words[i] || "");
    if (!det || !/^\p{Ll}/u.test(head) || head.length < 3 || isStop(head) || VERBISH.has(normalize(head)) || GENERIC.has(normalize(head)) || /\d/.test(head)) return null;
    np.push(head); i++;
    const adjOk = (w) => /^\p{Ll}/u.test(w) && (ADJ.test(w) || /(?:ad|id)[oa]s?$/.test(w)) && !VERBISH.has(normalize(w));
    while (i < words.length && np.length < 5 && !endsClause(words[i - 1])) {
      const w = bare(words[i]);
      if (adjOk(w) && !/^(el|la|los|las|un|una|estos|estas|este|esta|sus|su)$/i.test(words[i + 1] || "")) { np.push(w); i++; if (/^(y|e)$/.test(words[i] || "") && adjOk(bare(words[i + 1] || "")) && !endsClause(words[i - 1])) { np.push(words[i], bare(words[i + 1])); i += 2; } continue; }
      if (/^(de|del)$/i.test(words[i]) && words[i + 1] && isCap(words[i + 1])) { np.push(words[i], bare(words[i + 1])); i += 2; continue; }
      // «El ciclo del carbono», «La teoría de la evolución»: un complemento con «de» forma parte del concepto.
      if (np.length <= 2 && !np.some((w) => /^(de|del)$/i.test(w)) && /^(de|del)$/i.test(words[i])) {
        let j = i + 1;
        if (/^(la|las|los|el)$/i.test(words[j] || "")) j++;
        const w2 = bare(words[j] || "");
        if (/^\p{Ll}/u.test(w2) && w2.length >= 3 && !isStop(w2) && !VERBISH.has(normalize(w2)) && !endsClause(words[j - 1])) {
          np.push(...words.slice(i, j), w2); i = j + 1;
          // «de segundo grado», «de primer orden»: el ordinal necesita su sustantivo.
          if (/^(primer|primero|segundo|tercer|tercero|cuarto|quinto|alto|bajo|gran|mayor|menor)$/i.test(w2) && /^\p{Ll}{3,}$/u.test(bare(words[i] || "")) && !endsClause(words[i - 1])) { np.push(bare(words[i])); i++; }
          break;
        }
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
    // «Las voces griegas lo ven como…»: el pronombre remite a algo dicho antes.
    cliticRef: /^(lo|la|los|las)\s+\p{Ll}{3,}/u.test(rest) && !/^(lo|la|los|las)\s+(que|cual|cuales|mismo|misma|mismos|mismas|más|menos)\b/i.test(rest),
  };
}

// Limpieza del texto extraído de PDF: «palabra ,» → «palabra,», «( 1998 )» → «(1998)», «“ cita ”» → «“cita”», «" cita "» → «"cita"».
const tidy = (t) => t.replace(/"\s*([^"\n]{0,300}?)\s*"/g, '"$1"').replace(/\s+([,.;:!?)\]»”])/g, "$1").replace(/([(\[«¿¡“])\s+/g, "$1").replace(/\s{2,}/g, " ").trim();
// Referencias de página en los títulos: «Períodos de Calvi (pág. 20)» → «Períodos de Calvi».
const cleanTopic = (t) => t.replace(/\s*\((?:p[áa]gs?|pp?)\.?\s*[\d\s,\-–y]+\)/gi, "").replace(/[:\s]+$/, "").trim() || t;
// Verbos frecuentes y terminaciones verbales: una oración sin verbo es un fragmento, no una afirmación.
const VERB_WORDS = new Set(("es son fue fueron era eran sera seran esta estan estaba estaban estuvo tiene tienen tenia tenian tuvo hay habia ha han " +
  "puede pueden debe deben permite permiten incluye incluyen consiste consisten busca buscan define definen describe describen distingue distinguen " +
  "propone proponen plantea plantean considera consideran utiliza utilizan usa usan produce producen forma forman realiza realizan presenta presentan " +
  "indica indican senala senalan afirma afirman sostiene sostienen implica implican requiere requieren genera generan contiene contienen depende dependen " +
  "conviene convienen existe existen ocurre ocurren aparece aparecen sirve sirven suele suelen denomina denominan llama llaman fija fijan comienza comienzan surge surgen " +
  "explica explican estudia estudian analiza analizan evalua evaluan mide miden aporta aportan establece establecen favorece favorecen " +
  "crea crean funda fundan publica publican introduce introducen adapta adaptan agrega agregan rompe rompen aprende aprenden sustenta sustentan " +
  "va van sigue siguen exige exigen ayuda ayudan trata tratan ofrece ofrecen muestra muestran refleja reflejan determina determinan representa representan " +
  "constituye constituyen supone suponen abarca abarcan comprende comprenden aborda abordan combina combinan integra integran recoge recogen reune reunen " +
  "nace nacen pretende pretenden intenta intentan procura persigue emplea emplean aplica aplican incorpora incorporan mantiene mantienen rechaza rechazan " +
  "critica critican defiende defienden cuestiona cuestionan destaca destacan subraya enfatiza sugiere recomienda advierte reconoce reconocen acepta niega " +
  "prioriza garantiza garantizan protege protegen regula regulan obliga obligan prohibe sanciona sancionan apoya apoyan basa basan centra centran orienta " +
  "orientan divide dividen clasifica clasifican agrupa organiza organizan decide deciden logra logran obtiene obtienen alcanza alcanzan consigue cambia cambian " +
  "transforma transforman convierte convierten actua actuan funciona funcionan controla controlan almacena almacenan transmite transmiten transporta transportan " +
  "libera liberan absorbe absorben posee poseen carece carecen necesita necesitan causa causan provoca provocan afecta afectan influye influyen aumenta aumentan " +
  "disminuye disminuyen reduce reducen mejora mejoran facilita facilitan dificulta impide impiden evita evitan resuelve resuelven calcula calculan equivale " +
  "equivalen corresponde corresponden pertenece pertenecen relaciona relacionan vincula vinculan conecta conectan une unen separa separan compara comparan " +
  "entrena entrenan predice predicen procesa procesan detecta detectan imita imitan simula simulan fortalece fortalecen significa significan dijo propuso " +
  "podria podrian deberia deberian seria serian habra tendra tendran puso hizo hicieron dio dieron vio supo quiso pudo pudieron tuvieron estuvieron").split(" "));
const hasVerb = (t) => {
  const w = t.toLowerCase().split(/[\s,;:()«»"“”]+/).filter(Boolean);
  return w.some((x, i) => VERB_WORDS.has(normalize(x)) || (x.length > 3 && /(?:ó|aron|ieron|aba|aban|ían)$/.test(x)) || (/^(se|no|lo|le|les|nos)$/.test(w[i - 1] || "") && x.length > 2 && !isStop(x)));
};
// Oraciones que dependen de la anterior («Esta obra…», «Además…»): se muestran con su contexto.
const ANAPHOR = /^(este|esta|estos|estas|esto|ese|esa|esos|esas|eso|aquel|aquella|aquellos|aquellas|ello|dicho|dicha|dichos|dichas|su|sus|así|por ello|por eso|por lo tanto|por esta razón|por este motivo|de ahí|de este modo|de esta manera|de esta forma|de esa forma|sin embargo|no obstante|en cambio|en consecuencia|por consiguiente|incluye|incluyen|permite|permiten|él|ella|ellos|ellas|ambos|ambas|el primero|el segundo|la primera|la segunda|este último|esta última|lo anterior|los anteriores|las anteriores|tal|tales|allí|aquí|entonces|es decir|o sea|en este caso|en ese caso|para ello|con ello|con esto|de hecho|desde entonces|a partir de entonces|por entonces|hasta entonces|en ese momento|en esa época|otros|otras|el resto)(?![\p{L}\d])/iu;
// Conectores que solo enlazan con lo anterior («Además, …»): se quitan y la oración queda completa por sí sola.
const ADDITIVE = /^(además|asimismo|también|igualmente|por otro lado|por otra parte|finalmente|por último|en primer lugar|en segundo lugar|en tercer lugar|luego|después|a su vez)\s*,\s*/i;
// Etiquetas genéricas de esquema («Objetivo:», «Técnicas:», «Definición general:»): valen para preguntas abiertas, no para confundir conceptos entre sí.
const GEN_LABEL = /^(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|varias|algunos|algunas|denominaci[oó]n|denominaciones|nombres?|sin[oó]nimos?|objetivos?|ejemplos?|nota|notas|definici[oó]n|definiciones|concepto|conceptos|importante|resumen|caracter[ií]sticas?|funci[oó]n|funciones|causas?|consecuencias?|ventajas?|desventajas?|tipos?|clasificaci[oó]n|idea|ideas|conclusi[oó]n|conclusiones|autores?|fuente|fuentes|observaci[oó]n|finalidad|prop[oó]sito|etapas?|fases?|claves?|prueba|pruebas|t[eé]cnicas?|herramientas?|ambiente|condici[oó]n|condiciones|aspectos?|enfoque|origen|etimolog[ií]a|significado|contexto|otros|otras|inventarios?|instrumentos?|recursos?|materiales?|requisitos?|pasos?|elementos?|componentes?|partes|propiedades|f[oó]rmula|f[oó]rmulas|unidad|unidades|s[ií]mbolo|regla|reglas)(?![\p{L}\d])/iu;
// Una etiqueta de esquema es un concepto o un nombre: no empieza por pronombre, artículo neutro ni conector, ni lleva comas ni verbos.
const BAD_LABEL_START = /^(hoy|ayer|ahora|actualmente|antes|después|luego|entonces|aquí|allí|cuadro|tabla|figura|gr[áa]fico|imagen|foto|esquema|parte|lo|la|los|las|le|les|se|me|te|nos|su|sus|este|esta|estos|estas|esto|eso|ese|esa|aquí|así|según|como|cuando|si|pero|aunque|y|o|en|con|para|por|que|qué|cómo|hay|no|sí|muy|más|menos|también|ya|todo|toda|todos|todas|nuestro|nuestra|mi|tu|cap[ií]tulo|p[áa]gina|diapositiva|secci[oó]n|apartado|anexo|ojo)(?![\p{L}\d])/iu;
const isGeneric = (name) => GEN_LABEL.test(name) || GEN_LABEL.test(singular(name.split(/\s+/)[0].toLowerCase()));
const verbishWord = (w) => VERB_WORDS.has(normalize(w)) || /(?:aba|aban|ía|ían|ó|aron|ieron|ará|erá|irá|aría|ería|iría|ando|iendo)$/i.test(w);
// Etiqueta temporal («1911», «~1938», «Años 70», «Años 90, Jaime Arnau»): su línea es un hecho fechado, no un concepto.
const DATE_LABEL = /^(?:~|aprox\.?\s*|hacia\s+|en\s+)?(\d{3,4}|a[ñn]os\s+\d{2,4}|d[ée]cada\s+de\s+\d{2,4}|siglo\s+[\wIVXLC]+)(?:\s*[-–]\s*\d{2,4})?(?:,\s*(.+))?$/i;
function datePhrase(label) {
  const m = label.match(DATE_LABEL);
  if (!m) return null;
  const when = m[1], approx = /^(~|aprox|hacia)/i.test(label);
  const lead = /^\d/.test(when) ? (approx ? `Hacia ${when}` : `En ${when}`) : /^a[ñn]os/i.test(when) ? `En los ${when.toLowerCase()}` : `En ${when.charAt(0).toLowerCase() + when.slice(1)}`;
  return { lead, who: m[2] || "", when: label.replace(/^~/, "hacia ").trim() };
}

// Vocabulario del material: palabras que aparecen en minúscula (nombres comunes) y en mayúscula a mitad de frase (nombres propios).
let VOCAB = { lower: new Set(), midCaps: new Set(), words: new Set() };
// Acciones propias de un autor («propone», «critica», «creó»): con ellas el autor de la etiqueta es el sujeto.
const AGENT_VERB = /^(propone|propuso|plantea|planteó|afirma|afirmó|sostiene|sostuvo|señala|señaló|define|definió|considera|consideró|critica|criticó|crea|creó|desarrolla|desarrolló|introduce|introdujo|usa|usó|utiliza|utilizó|adapta|adaptó|agrega|agregó|distingue|distinguió|clasifica|clasificó|describe|describió|estudia|estudió|analiza|analizó|investiga|investigó|demuestra|demostró|descubre|descubrió|funda|fundó|publica|publicó|diseña|diseñó|construye|construyó|mide|midió|evalúa|evaluó|explica|explicó|defiende|defendió|rechaza|rechazó|cuestiona|cuestionó|reconoce|reconoció|identifica|identificó|divide|dividió|acuña|acuñó|dijo|ironizó|podría|formuló|elaboró|aporta|aportó|presenta|presentó|establece|estableció|formula|elabora|aplica|aplicó|inventa|inventó|observa|observó|compara|comparó|organiza|organizó|enuncia|enunció|deduce|dedujo|calcula|calculó)$/i;
function vocabOf(files) {
  const lower = new Set(), midCaps = new Set(), words = new Set();
  for (const f of files) for (const s of f.sections) {
    for (const m of s.text.matchAll(/\p{L}+/gu)) { words.add(m[0].toLowerCase()); if (/^\p{Ll}/u.test(m[0])) lower.add(normalize(m[0])); }
    for (const m of s.text.matchAll(/(?<=\p{Ll}[,;]?[ ]{1,2})\p{Lu}\p{Ll}{2,}/gu)) midCaps.add(normalize(m[0]));
  }
  return { lower, midCaps, words };
}
const commonWord = (w) => VOCAB.lower.has(normalize(w)) || ADJ.test(w) || GEN_LABEL.test(w);
// Nombre propio: aparece con mayúscula a mitad de frase y nunca en minúscula.
const properWord = (w) => VOCAB.midCaps.has(normalize(w)) && !VOCAB.lower.has(normalize(w));
const isAcronym = (w) => /^[\p{Lu}\d][\p{Lu}\d\-]{1,9}$/u.test(w) && /\p{Lu}.*\p{Lu}|\d/u.test(w);

/** Oraciones de un párrafo, sin cortar en abreviaturas («J. C. Raven», «EE. UU.», «ej.», «pág.»). */
function splitSentences(t) {
  const parts = t.split(/(?<=[.!?…])\s+(?=[\p{Lu}¿¡«"“\d(])/u), out = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && (/(?:^|[\s(.])(?:\p{Lu}|EE|Sr|Sra|Dr|Dra|Sto|Sta)\.$/u.test(prev) || /(?:^|[\s(])(?:ej|aprox|p[áa]gs?|pp?|p[áa]rr|vol|n[úu]m|cap|fig|vs|cf|ed|trad|op|cit|ca)\.$/i.test(prev))) out[out.length - 1] = prev + " " + p;
    else out.push(p);
  }
  return out;
}

/** «Período psicométrico: Binet (1905), Terman (1916)…» → {label, desc}. Null si no es una entrada de esquema clara. */
function parseTerm(line) {
  const m = line.match(/^([^:]{2,60}):\s+(.{4,320})$/);
  if (!m) return null;
  const label = m[1].trim().replace(/^(?:[a-z]|\d{1,2})\)\s+/, "");
  let desc = m[2].trim();
  // Una cita entre comillas se toma entera; si no, solo la primera oración. Si se coló otra entrada («… Cuestionario: MMPI…»), se corta ahí.
  const quote = desc.match(/^(["“«])([^"”»]{4,300})(["”»])/);
  desc = quote ? quote[0] : splitSentences(desc)[0].replace(/[.;]$/, "").trim();
  if (!quote) desc = desc.split(/\s(?=\p{Lu}[\p{L}\/ ]{2,40}:\s)/u)[0].replace(/[.;,]$/, "").trim();
  const name = label.replace(/\s*\([^)]*\)/g, "").trim() || label;
  const lw = name.split(/\s+/);
  const cited = /\([^)]*\b(?:\d{4}|s\.\s?f\.)[^)]*\)/.test(label);
  if (lw.length > 6 || !/^\p{Lu}/u.test(name) || DET.test(lw[0]) || BAD_LABEL_START.test(name) || /[,.;!?=≠→+]/.test(name) || /\d/.test(name)) return null;
  if ((lw.length > 1 && verbishWord(bare(lw[0]))) || lw.slice(1).some((w) => VERB_WORDS.has(normalize(w)))) return null;
  if (letterRatio(name) < 0.8 || (desc.match(/\(/g) || []).length !== (desc.match(/\)/g) || []).length) return null;
  const words = desc.replace(/\([^)]*\)/g, " ").split(/[\s,;]+/).filter((w) => /\p{L}/u.test(w));
  const content = words.filter((w) => !/^(y|e|de|del|la|las|los|el|van|von|da|di|du|le)$/i.test(w));
  const caps = content.filter((w) => isCap(w));
  // Lista de autores u obras: casi todo nombres propios (no siglas sueltas como «WISC», ni secuencias «A → B»).
  const refs = !quote && content.length > 0 && caps.length / content.length >= 0.7 && caps.filter((w) => !isAcronym(w)).length >= caps.length / 2 && !/→/.test(desc)
    && (/\(\s*(?:\d{4}|s\.\s?f\.)/.test(desc) || /\p{Lu}\p{Ll}+\s+(?:(?:de|del|van|von)\s+)?\p{Lu}\p{Ll}+/u.test(desc.replace(/\([^)]*\)/g, " ")) || /\bet al\b/.test(desc));
  // Lista de pruebas o instrumentos («HTP, TAT, CAT (~ años 50)», «d2 (2002) y EDAH (2001)»).
  const tests = !quote && !refs && content.length > 0 && content.length <= 12 && caps.length / content.length >= 0.6 && caps.filter((w) => isAcronym(w) || /\d/.test(w)).length >= Math.max(1, caps.length / 2);
  const attrib = /^(definici[oó]n|propuesta|postura|idea|teor[ií]a|visi[oó]n|cr[ií]tica|aporte|concepto|clasificaci[oó]n|modelo|planteamiento)\s+(?:de|del)\s+\p{Lu}/iu.test(name);
  const nameish = lw.every((w) => isCap(w) || /^(de|del|la|las|los|y|van|von|da|di)$/i.test(w)) && !lw.some((w) => isCap(w) && VOCAB.lower.has(normalize(w)) && !properWord(w));
  const person = !refs && !tests && !attrib && !lw.every((w) => isAcronym(w)) && ((cited && nameish)
    || (lw.length >= 2 && lw.length <= 4 && nameish && lw.filter(isCap).length >= 2)
    || (lw.length === 1 && /\p{Ll}/u.test(lw[0]) && !commonWord(lw[0]) && VOCAB.midCaps.has(normalize(lw[0]))));
  // Descripciones que no dicen nada por sí solas («más del 80% del tiempo», «sí», «2 casos») se descartan.
  if (!refs && !person && !quote && (words.length < 2 || /^(más|menos|casi|solo|sólo|hasta|desde|aprox|cerca|alrededor|~|\d|%|sí|no)\b/i.test(desc))) return null;
  // «Watson: con una docena de niños… podría formar a cualquiera» es una afirmación del autor: se trata como oración.
  // Afirmación: tiene verbo principal (no solo en una subordinada: «períodos que inician ~1900, cuando…» no lo tiene).
  const clause = !quote && hasVerb(desc.replace(/\([^)]*\)/g, " ").replace(/\b(?:que|quien|quienes|donde|cuando|cuyo|cuya)\b[^,;]*/gi, " ")) && /^\p{Ll}/u.test(desc) && desc.split(/\s+/).length >= 5;
  // «NEO PI-R (1998): fortalece los cinco grandes factores» → «NEO PI-R (1998) fortalece…» (la etiqueta es el sujeto).
  // El autor como sujeto si la acción es suya («Thurstone (~1931): contra el factor global, propone…» → «Thurstone (~1931), contra el factor global, propone…»).
  const firstVerb = (desc.replace(/\([^)]*\)/g, " ").match(/\p{L}+/gu) || []).find((x) => START_VERB.has(x.toLowerCase()) || /(?:ó|aron|ieron)$/.test(x)) || "";
  const lead = desc.slice(0, desc.indexOf(firstVerb));
  const agentAct = firstVerb && AGENT_VERB.test(firstVerb) && !/\b(?:el|la|los|las|un|una)\s+\p{Ll}+\s*$/u.test(lead.replace(/,\s*$/, ""));
  if (clause && (person || lw.length === 1 && !commonWord(lw[0])) && agentAct) return { claim: lead.trim() ? `${label}, ${lead.replace(/[,\s]+$/, "")}, ${desc.slice(lead.length)}.` : `${label} ${desc}.` };
  if (clause && (person || (lw.length === 1 && properWord(lw[0])))) return { claim: `Según ${label}, ${desc}.` };
  // «NEO PI-R (1998): fortalece los cinco grandes factores» → «NEO PI-R (1998) fortalece…» (la etiqueta es el sujeto).
  if (clause && !isGeneric(name) && !attrib && lw.every((w) => !commonWord(w) || /^(de|del|y)$/i.test(w)) && startsVerb(desc.charAt(0).toUpperCase() + desc.slice(1)) && !/^(se\s+(?:lo|la|los|las|le|les)|es decir)\b/i.test(desc)) return { claim: `${label} ${desc}.` };
  // «Entrevista semiestructurada: es la más recomendada…» → «La entrevista semiestructurada es la más recomendada…».
  if (clause && !isGeneric(name) && !attrib && !person && lw.length <= 4 && commonWord(lw[0]) && startsVerb(desc.charAt(0).toUpperCase() + desc.slice(1)) && !/^(se\s+(?:lo|la|los|las|le|les)|es decir)\b/i.test(desc)) {
    const pl = /[^s]s$/i.test(lw[0]) && !/(?:is|us)$/i.test(lw[0]);
    if (pl === pluralVerb(desc)) {
      const g = genderOf(pl ? singular(lw[0].toLowerCase()) : lw[0].toLowerCase());
      return { claim: `${pl ? (g === "f" ? "Las" : "Los") : g === "f" ? "La" : "El"} ${lcFirst(name)} ${desc}.`, asSubject: { name, desc } };
    }
  }
  // Flechas: solo una cadena «A → B → C» de elementos breves; «directivo → interrogatorio; no directivo → …» no es una entrada clara.
  if (/→/.test(desc) && !desc.split(/\s*→\s*/).every((x) => x.split(/\s+/).length <= 4 && !/[;,]/.test(x))) return null;
  return { label, name, desc, refs: refs || tests, tests, person, quote: !!quote, seq: /→.*→/.test(desc), attrib, clause, generic: isGeneric(name) || attrib };
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

// ---- Limpieza de página: cabeceras, pies, numeración, metadatos, notas editoriales, emojis y basura de OCR.
const PAGE_NO = /^(?:(?:page|p[áa]gina|p[áa]g\.?|slide|diapositiva|hoja)?\s*\d{1,4}\s*(?:(?:of|de|\/)\s*\d{1,4})?|\d(?:\s\d){1,3})$/i;
const META_LINE = /(^|\s)@\p{L}|^(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/iu;
// Acotaciones sobre el propio documento («(la diapositiva está cortada)», «(Faltan las págs. 31-33…)»): no son contenido.
const EDITORIAL = /\s*\((?=[^()]*(?:p[áa]gs?\.?\s*\d|p[áa]gina|\bpdf\b|diapositiva|se corta|est[áa] cortad[oa]|\bfaltan?\b|ojo:|no las? menciona|as[íi] lo dice|v[ée]ase|m[áa]s abajo|m[áa]s arriba|material de clase|aqu[íi] es la visi[óo]n))[^()]*\)/giu;
const furnitureKey = (l) => normalize(l).replace(/\d+/g, "#");
function furnitureOf(sections) {
  if (sections.length < 4) return new Set();
  const count = new Map();
  for (const s of sections) for (const k of new Set(s.text.split("\n").map(furnitureKey).filter((k) => k.length > 3))) count.set(k, (count.get(k) || 0) + 1);
  const min = Math.max(3, Math.ceil(sections.length * 0.3));
  return new Set([...count].filter(([k, n]) => n >= min && k.length <= 120).map(([k]) => k));
}
// «I N T R O D U C C I Ó N» → «INTRODUCCIÓN» (títulos con letras espaciadas).
const unspace = (l) => {
  const tk = l.trim().split(/\s+/);
  if (tk.length >= 5 && tk.filter((t) => t.length === 1).length / tk.length > 0.7) return l.trim().split(/\s{2,}/).map((c) => c.replace(/\s+/g, "")).join(" ");
  return l.replace(/(?:^|(?<=\s))((?:\p{L}\s){3,}\p{L})(?=\s|$)/gu, (m) => m.replace(/\s/g, ""));
};
// Ligaduras partidas por el PDF: «De fi niciones» → «Definiciones», «( fl exibilidad)» → «(flexibilidad)».
const fixLigatures = (l) => l.replace(/(?:(\p{L}+)\s)?(?<!\p{L})(ffi|ffl|fi|fl|ff)\s+(\p{Ll}+)/gu, (m, a, lig, b) => {
  if (a && VOCAB.words.has((a + lig + b).toLowerCase())) return a + lig + b;
  if (!a || VOCAB.words.has((lig + b).toLowerCase()) || /^(de|en|la|el|los|las|un|una|y|o|a|con|por|para|se|su|sus|del|al|que|lo|muy|más|sin)$/i.test(a)) return (a ? a + " " : "") + lig + b;
  return a + lig + b;
});
const OCR_OK_SHORT = new Set("a y o u e de el la en un se no lo le su al es ya si ni mi tu me te ha he os".split(" "));
// Restos de OCR al final de la línea («… fue al caballo. f >” |»): se quitan los tokens que no son palabras.
function trimOcrJunk(line) {
  const w = line.split(/\s+/);
  const junk = (t) => /[|<>=~^_\\{}#®©™]/.test(t) || /^[^\p{L}\p{N}«“"(¿¡]+$/u.test(t) || /^\p{Lu}$/u.test(t) || (/^\p{L}{1,2}$/u.test(t) && !OCR_OK_SHORT.has(t.toLowerCase())) || /^\p{Lu}{2,3}$/u.test(t) && !/^(UU|EE|ADN|ARN|IA|TIC|ONU|OMS|APA|PIB)$/.test(t);
  while (w.length > 3 && junk(w[w.length - 1])) w.pop();
  while (w.length > 3 && junk(w[0]) && !/^\d/.test(w[0])) w.shift();
  return w.join(" ");
}
const letterRatio = (t) => (t.match(/\p{L}/gu) || []).length / Math.max(1, t.replace(/\s/g, "").length);
/** Líneas limpias de una sección: sin cabeceras/pies, numeración, metadatos, notas editoriales, emojis sueltos ni basura de OCR. */
function cleanLines(sec, furniture) {
  const ocr = sec.origin !== "native_text";
  return sec.text.replace(/\r/g, "").replace(/\[[^\]]*\]/g, " ").replace(EDITORIAL, "").split("\n").map((raw) => {
    let l = unspace(raw.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}✦★☆•▪►◆◇■□●○]/gu, " ")).replace(/(\p{L})\*/gu, "$1");
    l = ocr ? trimOcrJunk(l.trim()).replace(/(?<![\p{L}])(a|en|de|con|por|y|que|así)(los|las|lo|el)(?=\s)/giu, "$1 $2").replace(/(?<![\p{L}])(en|de|con|por|y|que|así)(la)(?=\s)/giu, "$1 $2") : fixLigatures(l);
    const t = l.trim();
    if (!t) return "";
    if (PAGE_NO.test(t) || META_LINE.test(t) || furniture.has(furnitureKey(t))) return null;
    // En texto digital solo se descartan líneas sin letras ni cifras («— — —»); «1970) .» continúa la línea anterior.
    if (ocr ? letterRatio(t) < 0.7 || t.length < 4 : !/[\p{L}\p{N}]/u.test(t)) return null;
    return l.replace(/\s+$/, "");
  }).filter((l) => l !== null);
}

// ---- Tablas: una fila de encabezado con celdas cortas separadas por 3+ espacios y filas «Etiqueta   descripción».
// Solo se leen las de dos columnas con una columna de nombres («Ámbito | Qué pasa», «Función | Qué hace»);
// las de más columnas mezclan celdas al partir líneas, así que se omiten enteras en lugar de convertirlas en frases rotas.
const cellsOf = (l) => l.trim().split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);
const shortCell = (c) => c.split(/\s+/).length <= 4 && /^[\p{Lu}¿]/u.test(c) && !/[.;:,]$/.test(c) && letterRatio(c) > 0.7;
const rowLabel = (c) => c.replace(/^(?:[a-z]|\d{1,2})\)\s+/, "");
function markTables(lines) {
  const out = [];
  let head = null, ok = false, row = null;
  const flush = () => { if (row && ok && !/\//.test(row.label)) out.push(`\u0001R\u0001${head.join("\u0002")}\u0001${row.label}\u0001${row.desc.join(" ")}`); row = null; };
  const end = (l) => { flush(); head = null; if (l !== undefined) out.push(l); };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], cells = cellsOf(l), t = l.trim();
    if (!head) {
      const nextLine = lines.slice(i + 1).find((x) => x.trim()) || "";
      const next = cellsOf(nextLine);
      if (cells.length >= 2 && cells.length <= 5 && cells.every(shortCell) && cells.join(" ").split(/\s+/).length <= 10 && next.length >= 2 && shortCell(rowLabel(next[0]))) {
        head = cells;
        ok = cells.length === 2 && cells[0].split(/\s+/).length === 1;
        continue;
      }
      out.push(l);
      continue;
    }
    if (!t) { end(l); continue; }
    const nextCells = cellsOf(lines.slice(i + 1).find((x) => x.trim()) || "");
    if (cells.length >= 2 && cells.length <= 5 && cells.every(shortCell) && /^(?:para\s+)?(?:qu[ée]|c[oó]mo|cu[aá]ndo|d[oó]nde|por\s+qu[ée])(?=\s|$)|^(significado|definici[oó]n|descripci[oó]n|caracter[íi]sticas?|ejemplos?|enfoque|tipos?|aporte|autor|años?|uso|objetivo)$/iu.test(cells[1]) && nextCells.length >= 2) {
      flush(); head = cells; ok = cells.length === 2 && cells[0].split(/\s+/).length === 1; continue;
    }
    if (cells.length >= 2 && shortCell(rowLabel(cells[0])) && !(cells.length === head.length && cells.every((c, k) => normalize(c) === normalize(head[k])))) {
      flush(); row = { label: rowLabel(cells[0]), desc: [cells.slice(1).join(" ")] }; continue;
    }
    if (cells.length === head.length && cells.every((c, k) => normalize(c) === normalize(head[k]))) { flush(); continue; }
    // Líneas de continuación de una celda: empiezan en minúscula o son cortas (las tablas parten el texto en renglones breves).
    if (/:$/.test(t) || headingLike(t) && /^(?:\d{1,2}[.)]|[A-Z]\))\s/.test(t)) { end(l); continue; }
    if (row && (/^[\p{Ll}(«“"]/u.test(t) || t.length <= 48)) { row.desc.push(t); continue; }
    if (!row && t.length <= 48) continue;
    end(l);
  }
  flush();
  return out;
}

/**
 * Une las líneas que el PDF o el OCR cortaron por el ancho de la página y quita los guiones de corte,
 * también entre páginas: las marcas de página (\u0002…) no cortan un párrafo.
 */
function reflow(text) {
  const out = [];
  let blankRun = 0, last = -1;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { blankRun++; continue; }
    if (line.startsWith("\u0002")) { out.push(line); continue; }
    const prev = last >= 0 ? out[last] : "";
    const plain = prev && !prev.startsWith("\u0001") && !line.startsWith("\u0001") && blankRun <= 1;
    const continues = plain && !/[.!?:;]$/.test(prev) && !BULLET.test(line) && !headingLike(prev)
      && (/^[\p{Ll}\d(«"“)]/u.test(line) || /[-,]$/.test(prev) || JOINER.test(prev));
    // Títulos partidos en dos renglones («Un Estado que pone reglas firmes y las hace» + «cumplir»).
    const closer = plain && !/[.!?:;]$/.test(prev) && !headingLike(prev) && /^\p{Lu}[\p{L}\-]*\s?[.)]+$/u.test(line);
    const headTail = plain && headingLike(prev) && /^\p{Ll}/u.test(line) && line.split(/\s+/).length <= 4 && !/[.!?:;]$/.test(prev);
    if (continues || headTail || closer) out[last] = /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(line) ? prev.slice(0, -1) + line : prev + " " + line;
    else { if (blankRun && out.length) out.push(""); out.push(line); last = out.length - 1; }
    blankRun = 0;
  }
  return out;
}

// Clase de los elementos que introduce una lista («Cattell define 3 tipos de rasgos:» → «tipo de rasgo» / «rasgos»).
const GROUP_NOUNS = /\b(tipos|clases|formas|categor[ií]as|niveles|grupos|modalidades|variantes|estilos|modelos|etapas|fases|momentos|criterios|dimensiones|factores|elementos|componentes|principios|pasos|t[eé]cnicas|funciones|caracter[ií]sticas|variables|propiedades|partes|leyes|reglas|m[eé]todos|operaciones|estados|procesos|algoritmos|enfoques|teor[ií]as|escuelas|corrientes)\s+(?:de\s+(?:la\s+|las\s+|los\s+|el\s+)?)?(\p{L}+)?/iu;
const singular = (w) => {
  if (/(?:is|us)$/i.test(w) || !/s$/i.test(w)) return w;
  if (/iones$/i.test(w)) return w.replace(/iones$/i, "ión");
  if (/(?:dad|tad|tud|or|ar|er|ir|al|el|il|ol|ul|ón|án|én|ín|n|y|j|d)es$/i.test(w)) return w.replace(/es$/i, "");
  if (/[aeiouáéíóú]ces$/i.test(w) && w.length <= 6) return w.replace(/ces$/i, "z");
  return w.replace(/s$/i, "");
};
// Género gramatical de un sustantivo en singular (para «el/la», «un/una»).
const MASC_A = /^(problema|sistema|tema|programa|clima|idioma|esquema|mapa|d[ií]a|planeta|cometa|poeta|atleta|teorema|axioma|dilema|lema|paradigma|diagrama|drama|enigma|fantasma|dogma|aroma|panorama|prisma|s[ií]ntoma|trauma|estigma|carisma|poema|psiquiatra|pediatra|astronauta|gu[ií]a|pijama|sof[áa]|mediod[ií]a|an[áa]lisis|[ée]nfasis|par[ée]ntesis|oasis|virus|atlas|cosmos|telescopio|electrodom[ée]stico)$/i;
const FEM_X = /^(s[ií]ntesis|hip[óo]tesis|crisis|tesis|base|clase|fase|frase|parte|gente|mente|muerte|suerte|noche|nube|llave|calle|carne|sangre|fuente|corriente|serie|especie|superficie|imagen|ley|red|sed|pared|piel|sal|miel|luz|voz|vez|cruz|paz|ra[ií]z|nariz|flor|mujer|labor|torre|leche|fe|hambre|costumbre|actitud|salud|virtud|juventud|nave|clave|muestra|mano|radio|foto|moto)$/i;
const genderOf = (w) => { const s = String(w).toLowerCase(); if (MASC_A.test(s)) return "m"; if (FEM_X.test(s)) return "f"; return /(?:a|ión|dad|tad|tud|umbre|ie|ez|itis|sis)$/.test(s) ? "f" : "m"; };
function kindFromIntro(intro) {
  const m = intro.match(GROUP_NOUNS);
  if (!m) return null;
  const head = normalize(m[1]), of = m[2] && !isStop(m[2]) && !verbishWord(m[2]) && !/^\d/.test(m[2]) ? m[2].toLowerCase() : "";
  const k = KINDS[head] || [singular(m[1].toLowerCase()), genderOf(singular(m[1].toLowerCase()))];
  return of ? { n: `${k[0]} de ${singular(of)}`, g: k[1], pn: of } : { n: k[0], g: k[1] };
}
// Encabezado de tabla → clase de elemento y lo que describe la segunda columna («Función | Qué hace» → función, «hace»).
function kindFromHead(head) {
  const first = head[0].toLowerCase(), plural = /s$/i.test(first) && !/[ií]s$/i.test(first), n = plural ? singular(first) : first;
  const q = (head[1] || "").match(/^(?:para\s+)?(?:qu[ée]|c[oó]mo|cu[aá]ndo|d[oó]nde|por\s+qu[ée])\s+(.+)$/i);
  return { n, g: genderOf(n), verb: q ? (/^para/i.test(head[1]) ? "sirve para" : q[1].toLowerCase()) : "", attr: q ? "" : (head[1] || "").toLowerCase(), head: head.join(" / ") };
}

// ---- Referentes: de qué se habla cuando la oración omite el sujeto («Es el método madre de las ciencias.» bajo «3. La observación»).
// Títulos que no nombran el concepto del que se habla («Origen del término», «Propósito de la obra», «Nota inicial»…).
const META_NOUN = /^(origen|prop[oó]sito|punto|nota|notas|introducci[oó]n|definici[oó]n|definiciones|etimolog[ií]a|consideraciones|conclusi[oó]n|conclusiones|resumen|objetivos?|bibliograf|temas?|historia|contexto|planteamiento|desarrollo|breve|cap[íi]tulo|unidad|parte|secci[oó]n|anexo|reflexi[oó]n|ideas?|aspectos?|elementos?|tipos?|clasificaci[oó]n|cuadro|tabla|ejemplos?|preguntas?|actividad|ejercicios?|repaso|glosario|marco|una|un|otros|otras|caso real|integrantes|presentaci[oó]n|[íi]ndice)(?![\p{L}\d])/iu;
// Apartados que hablan del propio documento: sus oraciones no se preguntan.
const META_HEAD = /^(?:nota inicial|notas?|[íi]ndice|contenidos?|tabla de contenidos?|bibliograf[íi]a|referencias(?: bibliogr[áa]ficas)?|webgraf[íi]a|agradecimientos?|integrantes|pr[oó]logo|prefacio|prop[oó]sito de la obra|los temas del texto|sobre (?:este|el) (?:texto|documento|resumen|libro))(?![\p{L}\d])/iu;
// Oraciones sobre el propio material, la clase o el trabajo en grupo («Lo que está entre paréntesis…», «Skinner no se desarrolla…»).
const META_SENT = /\b(?:est[ea]s?|el presente|la presente|del primer|del segundo|nuestr[oa]s?)\s+(?:resumen|documento|pdf|texto|archivo|apuntes?|libro|trabajo|presentaci[oó]n|diapositivas?|grupo|exposici[oó]n|ensayo|cap[ií]tulo|material|objetivo)\b|\bp[áa]gs?\.\s*\d|\bpdf\b|\bla clase\b|\bm[áa]s (?:abajo|arriba|adelante)\b|\bhacia el final\b|\bcomo (?:veremos|se ver[áa])\b|\bno se desarrolla\b|\bmerece un ensayo\b|\bquedan? fuera\b|\bpor falta de espacio\b|\bse corta\b|\bdiapositiva\b|\baqu[íi] conectamos\b|\bentre par[ée]ntesis\b|\bconservando t[íi]tulos\b|\bsi te preguntan\b|\bc[íi]talo\b|\ben el oral\b/i;
// Verbos con los que una oración puede empezar sin sujeto («Estudia la intersubjetividad…», «Se apoya en…»).
const START_VERB = new Set(("es son fue fueron era eran será serán está están estaba estaban estuvo tiene tienen tenía tenían tuvo ha han había puede pueden podría podrían debe deben " +
  "suele suelen permite permiten incluye incluyen consiste consisten busca buscan define definen describe describen distingue distinguen propone proponen plantea plantean " +
  "considera consideran utiliza utilizan usa usan produce producen realiza realizan presenta presentan indica indican señala señalan afirma afirman sostiene sostienen implica " +
  "implican requiere requieren genera generan contiene contienen depende dependen sirve sirven comienza comienzan explica explican estudia estudian analiza analizan evalúa " +
  "evalúan mide miden aporta aportan establece establecen favorece favorecen crea crean funda publica introduce adapta agrega rompe rompen aprende aprenden sustenta sustentan " +
  "va van sigue siguen exige exigen ayuda ayudan trata tratan ofrece ofrecen muestra muestran refleja reflejan determina determinan representa representan constituye constituyen " +
  "supone abarca abarcan comprende comprenden aborda abordan combina combinan integra integran recoge reúne nace nacen pretende pretenden intenta intentan procura persigue " +
  "emplea emplean aplica aplican incorpora mantiene mantienen rechaza rechazan critica critican defiende defienden cuestiona cuestionan destaca destacan subraya enfatiza sugiere " +
  "recomienda advierte reconoce reconocen acepta niega prioriza garantiza garantizan protege protegen regula regulan obliga obligan prohíbe sanciona sancionan apoya apoyan " +
  "centra centran orienta orientan divide dividen clasifica clasifican agrupa organiza organizan decide deciden logra logran obtiene obtienen alcanza alcanzan consigue cambia " +
  "cambian transforma transforman convierte convierten actúa actúan funciona funcionan controla controlan almacena almacenan transmite transmiten libera liberan absorbe absorben " +
  "posee poseen carece carecen necesita necesitan provoca provocan afecta afectan influye influyen aumenta aumentan disminuye disminuyen reduce reducen mejora mejoran facilita " +
  "facilitan dificulta impide impiden evita evitan resuelve resuelven calcula calculan equivale equivalen corresponde corresponden pertenece pertenecen relaciona relacionan " +
  "vincula vinculan conecta conectan une unen separa separan compara comparan entrena entrenan predice predicen procesa procesan detecta detectan imita imitan simula simulan " +
  "fortalece fortalecen significa significan dijo propuso hizo dio usó creó fundó publicó acuñó desarrolló definió describió planteó demostró descubrió inventó formuló " +
  "elaboró diseñó construyó realizó ganó marcó impulsó surgió apareció nació generó introdujo adaptó agregó estudió produjo").split(" "));
const SE_PREP = /^(en|a|al|de|del|con|por|como|desde|sobre|entre|hacia|mediante|según|para|sin|tras)$/i;
// Sustantivos de persona al inicio («Psicólogo colombiano, …»): describen a alguien, no al concepto del título.
const PERSON_NOUN = /(?:ólog[oa]s?|dor|dora|dores|doras|ero|era|eros|eras)$/i;
/** El título convertido en sujeto: «3. La observación» → «la observación», «Modelo FENOMENOLÓGICO» → «el modelo fenomenológico». Vacío si no nombra un concepto. */
function topicNP(topic) {
  let t = topic;
  if (/:/.test(t)) {
    const [a, b] = t.split(/:\s*/, 2);
    const q = (b || "").match(/^¿?\s*qu[ée] (?:es|son) (.+?)\??$/i);
    t = q ? q[1] : a;
  }
  t = t.replace(/^(?:cap[íi]tulo|tema|unidad|bloque|m[oó]dulo)\s+\d+\s*[:.]?\s*/i, "").replace(/^(?:\d{1,2}(?:\.\d{1,2})*|[a-zA-Z]|[IVX]{1,4})[.)]\s+/, "").replace(/\s*\([^)]*\)/g, "").replace(/[¿?]/g, "").trim();
  const of = t.match(/^(?:caracter[íi]sticas|cualidades|rasgos|funciones|tareas|deberes|habilidades|competencias|requisitos|propiedades|ventajas|desventajas|errores|perfil)\s+(?:de|del)\s+(.+)$/i);
  if (of) {
    const x = (/^del\s/i.test(t.slice(of[0].length - of[1].length - 4)) ? "el " : "") + of[1];
    const xw = x.split(/\s+/);
    if (DET.test(xw[0]) && xw.length <= 6 && !hasVerb(x)) return { np: x.charAt(0).toLowerCase() + x.slice(1), plural: PLURAL_DET.test(xw[0]), head: normalize(xw[1] || ""), of: true };
  }
  const w = t.split(/\s+/);
  if (!t || /[·/–—|"“«]/.test(t) || w.length > 6 || META_NOUN.test(t) || hasVerb(t) || BAD_LABEL_START.test(t) && !DET.test(w[0])) return null;
  // «X y Y»: solo si coordina adjetivos («Entrevistas estructuradas y semiestructuradas»).
  const adjLike = (x) => ADJ.test(x) || /(?:ad|id)[oa]s?$/i.test(x);
  const yi = w.findIndex((x) => /^(y|e|o|u)$/i.test(x));
  if (yi >= 0 && !(adjLike(w[yi - 1] || "") && adjLike(w[yi + 1] || ""))) return null;
  // Mayúsculas de diseño: frase en mayúsculas → minúsculas; una palabra suelta en mayúsculas es un nombre («PIAGET» → «Piaget») salvo plurales, adjetivos y siglas.
  const allCaps = (x) => /^\p{Lu}{2,}$/u.test(bare(x));
  const words = w.map((x, i) => {
    if (!allCaps(x)) return x;
    if (allCaps(w[i - 1] || "") || allCaps(w[i + 1] || "") || /S$/.test(x) || ADJ.test(x.toLowerCase())) return x.toLowerCase();
    return x.length <= 4 ? x : x.charAt(0) + x.slice(1).toLowerCase();
  });
  let first = words[0];
  if (DET.test(first)) return { np: [first.toLowerCase(), ...words.slice(1)].join(" "), plural: PLURAL_DET.test(first), head: normalize(words[1] || "") };
  const lower = first.toLowerCase();
  // Infinitivo: «Integrar la psicología en un solo modelo».
  if (/^\p{Ll}+(?:ar|er|ir)$/u.test(lower) && !properWord(first)) return { np: [lower, ...words.slice(1)].join(" "), plural: false, head: normalize(lower), inf: true };
  // Nombre propio solo («Wundt», «Piaget»).
  if (words.length === 1 && isCap(first) && !commonWord(first)) return { np: first, plural: false, head: normalize(first), proper: true };
  if (!/^\p{Lu}\p{Ll}/u.test(first) || !commonWord(first) && !/(?:ción|sión|miento|ento|dad|ismo|ía|ica|ico|ura|encia|ancia|aje|ma)s?$/i.test(first)) return null;
  const plural = /[^s]s$/i.test(first) && !/(?:is|us|sis)$/i.test(first);
  const g = genderOf(plural ? singular(lower) : lower);
  const det = plural ? (g === "f" ? "las" : "los") : g === "f" ? "la" : "el";
  return { np: [det, lower, ...words.slice(1)].join(" "), plural, head: normalize(plural ? singular(lower) : lower) };
}
const lcFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const startsVerb = (t) => {
  const w = t.split(/\s+/).map((x) => bare(x).toLowerCase());
  if (/^\p{Ll}{4,}(?:a|e|an|en)$/u.test(w[0]) && !VOCAB.lower.has(normalize(w[0])) && !properWord(w[0]) && /^(su|sus|con|en|a|al|que|qué|lo|le|les|se|no|por|para|muy|más|menos|bien|mal)$/.test(w[1] || "")) return true;
  if (w[0] === "no") return START_VERB.has(w[1] || "") || /(?:ó|aron|ieron)$/.test(w[1] || "");
  if (w[0] === "se") return (START_VERB.has(w[1] || "") || /(?:a|an|e|en|ó|aron|ieron)$/.test(w[1] || "")) && !/^(lo|la|los|las|le|les)$/.test(w[1] || "");
  return START_VERB.has(w[0]) || (w[0].length > 4 && /(?:ó|aron|ieron)$/.test(w[0]) && !/ción$|sión$/.test(w[0]));
};
const pluralVerb = (t) => { const w = t.split(/\s+/).map((x) => bare(x).toLowerCase()); const v = /^(no|se)$/.test(w[0]) ? w[1] : w[0]; return /(?:n|ron)$/.test(v || ""); };
/**
 * Completa el sujeto que la oración omite usando el título del apartado, si es seguro:
 *  «Es el método madre…» → «La observación es el método madre…»; «Concepto muy importante…» → «La medición es un concepto muy importante…»;
 *  «Este modelo originó…» → «El modelo de rasgos originó…»; «Sus herramientas…» → «Las herramientas del modelo de Piaget…».
 * Devuelve {text, rewritten, needsCtx, drop}.
 */
function resolveSubject(t, np, first) {
  const lead = t.match(/^((?:según|para|de acuerdo con|en opinión de)\s[^,]{2,60},\s+)(.+)$/i);
  const pre = lead ? lead[1] : "", body = lead ? lead[2] : t;
  const w = body.split(/\s+/), w0 = bare(w[0] || "").toLowerCase();
  const fits = np && (np.plural === pluralVerb(body) || /^(es|fue|era|será)$/.test(w0) && !np.plural || /^(son|fueron|eran|serán)$/.test(w0) && np.plural);
  // Demostrativo con el mismo sustantivo del título: «Este modelo» en «Modelo de rasgos».
  const dem = body.match(/^(Este|Esta|Estos|Estas|Dicho|Dicha|Dichos|Dichas)\s+(\p{L}+)\s/u);
  if (dem && np && normalize(singular(dem[2])) === np.head) return { text: pre + (pre ? np.np : ucFirst(np.np)) + body.slice(dem[0].length - 1), rewritten: true };
  if (/^(se\s+(?:lo|la|los|las|le|les)\b)/i.test(body)) return { text: t, needsCtx: true };
  if (/^(con|junto a|junto con)\s/i.test(body) && !/,/.test(body.slice(0, 60))) {
    const j = w.slice(1, 7).findIndex((x) => START_VERB.has(bare(x).toLowerCase()) || /(?:ó|aron|ieron)$/.test(bare(x)));
    if (j >= 0) return { text: t, needsCtx: true };
  }
  // Pronombre que remite a algo ya dicho a mitad de frase («Blumenthal … lo llama fundador…», «el psicólogo la conduce»).
  if (/(?:^|[\s,)])(?:lo|la|los|las)\s+(\p{Ll}+)/u.test(body)) {
    const v = body.match(/(?:^|[\s,)])(?:lo|la|los|las)\s+(\p{Ll}+)/u)[1];
    if ((START_VERB.has(v) || /^(llama|llaman|conduce|conducen|ve|ven|hace|hacen|dice|dicen|mantiene|dispara)$/.test(v)) && !/^(es|son|que|ayuda|muestra|parte|forma|base|vuelta)$/.test(v)) return { text: t, needsCtx: true };
  }
  // «Se apoya en…» (el sujeto es el tema) frente a «Se obtiene información…» (pasiva con su propio sujeto, que depende de lo anterior).
  if (w0 === "se" && !/^se trata de\s/i.test(body)) {
    const w2 = bare(w[2] || "").toLowerCase();
    if (w2 && !SE_PREP.test(w2) && !/mente$/.test(w2)) return { text: t, needsCtx: true };
  }
  if (startsVerb(body)) {
    if (pre || !first || !np || !fits || !(START_VERB.has(w0) || w0 === "no" && START_VERB.has(bare(w[1] || "").toLowerCase()) || w0 === "se") || np.inf && !/^(es|son|consiste|supone|implica|permite|requiere|significa)$/.test(w0)) return { text: t, needsCtx: true };
    if (/^se trata de\s/i.test(body)) return { text: pre + (pre ? np.np : ucFirst(np.np)) + " " + (np.plural ? "son" : "es") + " " + body.replace(/^se trata de\s+/i, ""), rewritten: true };
    return { text: pre + (pre ? np.np : ucFirst(np.np)) + " " + lcFirst(body), rewritten: true };
  }
  const poss = body.match(/^(Su|Sus)\s+(\p{Ll}+)\s/u);
  if (poss) {
    if (!first || !np || pre) return { text: t, needsCtx: true };
    const g = genderOf(poss[1] === "Sus" ? singular(poss[2]) : poss[2]);
    const det = poss[1] === "Sus" ? (g === "f" ? "Las" : "Los") : g === "f" ? "La" : "El";
    return { text: contract(`${det} ${poss[2]} de ${np.np} `) + body.slice(poss[0].length), rewritten: true };
  }
  // Inicio con un sustantivo o adjetivo sin artículo («Concepto muy importante…», «Estructuralista y constructivista…»): define el concepto del título.
  if (!pre && /^\p{Lu}\p{Ll}+$/u.test(bare(w[0] || "")) && !DET.test(w0) && !LEAD_PREP.test(w0) && !isStop(w0) && !properWord(w0) && !/mente$/.test(w0)
    && !DET.test(bare(w[1] || "")) && !/^(su|sus|lo|le|les|se|que|qué|con|en|a|al|no|por|para)$/i.test(bare(w[1] || ""))
    && !/^(hoy|cada|todo|toda|todos|todas|muchos|muchas|varios|varias|algunos|algunas|otros|otras|ambos|ambas|cuando|como|si|aunque|mientras|donde|aquí|allí|ya|nunca|siempre|primero|luego|parte|lo|hay|tanto|cuanto|uno|una|dos|tres)$/.test(w0)) {
    const noun = !ADJ.test(w0);
    // Verbo principal: sin paréntesis ni subordinadas («Rechazo al positivismo, que descartó…» no tiene).
    const mainVerb = hasVerb(body.replace(/\([^)]*\)/g, " ").split(/[;:]/)[0].replace(/\b(?:que|quien|quienes|donde|cuando|cuyo|cuya|cuyos|cuyas)\b.*$/i, ""));
    if (!first || !np || np.proper || np.of || mainVerb || /:/.test(body) || PERSON_NOUN.test(w0) || normalize(noun ? singular(w0) : w0) === np.head || body.split(/\s+/).length < 4) return { text: t, drop: !mainVerb };
    const ind = noun ? (/[^s]s$/.test(w0) ? "" : genderOf(w0) === "f" ? "una " : "un ") : "";
    // Una enumeración («Potencial de aprendizaje, modelos neuropsicológicos y procesamiento…») se presenta con «incluye».
    if (/,/.test(body.replace(/\([^)]*\)/g, "")) && /\sy\s/.test(body)) return { text: `${ucFirst(np.np)} ${np.plural ? "incluyen" : "incluye"} ${lcFirst(body)}`, rewritten: true };
    return { text: `${ucFirst(np.np)} ${np.plural ? "son" : "es"} ${ind}${lcFirst(body)}`, rewritten: true };
  }
  return { text: t };
}
// Notación de apuntes convertida en texto: «Observar = mirar…» → «Observar significa mirar…», «Conversar ≠ entrevistar» → «… no es lo mismo que …»,
// «X → Y» → «X (resultado: Y)» o «Si X, entonces Y». Las secuencias «A → B → C» se dejan.
function proseOf(t) {
  t = t.replace(/\s*≠\s*/g, " no es lo mismo que ").replace(/(^|[(:;,.]\s*)([^=:;,.()]{1,40}?)\s+=\s+(?=\p{L})/gu, (m, a, x) => `${a}${x} significa `);
  const n = (t.match(/→/g) || []).length;
  if (n !== 1) return t;
  const [a, b] = t.split(/\s*→\s*/);
  const tail = b.replace(/[.!?]+$/, "").trim(), head = a.replace(/[,;:]\s*$/, "").trim();
  if (!tail || !head) return t;
  if (hasVerb(tail)) return `${head}${/\bsi\b/i.test(head) ? ", entonces" : "; por eso,"} ${lcFirst(tail)}.`;
  return `${head} (resultado: ${tail}).`;
}

/**
 * ¿Se entiende la oración sola? Empieza por artículo o cuantificador, un nombre propio, «Hay…», un infinitivo con verbo principal,
 * un sustantivo con su verbo («Psicometría y tests nacieron juntos») o «Según X, …» seguido de algo de eso.
 * Si no («Como la conducta es estable, es predecible.», «Detrás está…»), necesita la oración anterior como contexto.
 */
function selfStart(t) {
  const w = t.split(/\s+/), w0 = bare(w[0] || ""), l0 = w0.toLowerCase();
  const main = (x) => hasVerb(x.replace(/\([^)]*\)/g, " ").replace(/\b(?:que|quien|quienes|donde|cuando|cuyo|cuya|cuyos|cuyas)\b[^,;]*/gi, " "));
  if (/^(?:el|la|los|las)\s+(?:dos|tres|cuatro|primer[oa]s?|segund[oa]s?|últim[oa]s?|anteriores|mism[oa]s?|demás)\b/i.test(t)) return false;
  if (DET.test(l0) || /^(hay|existe|existen|cada|todo|toda|todos|todas|ningún|ninguna|muchos|muchas|varios|varias|algunos|algunas|ambos|ambas|otro|otra|dos|tres|cuatro|cinco|gran|pocos|pocas)$/.test(l0)) return !/^(ambos|ambas|otro|otra)$/.test(l0);
  if (/\bhay que\b/i.test(t.slice(0, 80))) return true;
  if (/^(en|durante|desde|hacia|hasta|según|para|tras|ante|bajo|entre|sobre|hoy|actualmente|antes|después|aunque|si|cuando|como|mientras|al|a|de|por|con|sin|aproximadamente)$/.test(l0)) {
    if (/^(en|durante|desde|hacia|hasta)\s+(?:\d|el año|la década|los años|el siglo|la actualidad)/i.test(t) && !/,/.test(t.slice(0, 25))) return true;
    const c = t.indexOf(", ");
    return c > 0 && c < 110 && selfStart(ucFirst(t.slice(c + 2)));
  }
  if (/^(De|Del|Van|Von|Mc|Mac)$/.test(w0) && isCap(w[1] || "")) return true;
  if (isCap(w0) && (properWord(w0) || isCap(w[1] || "") && !DET.test(bare(w[1] || "")) || isAcronym(w0))) return true;
  // Verbo seguido de su sujeto («Comienzan las controversias…», «Existen muchos tipos…»).
  if (/^(comienza|comienzan|surge|surgen|aparece|aparecen|existe|existen|nace|nacen|llega|llegan|ocurre|ocurren|predomina|predominan)$/.test(l0) && DET.test(bare(w[1] || "")) || /^(muchos|muchas|varios|varias|algunos|algunas|dos|tres)$/.test(bare(w[1] || "").toLowerCase()) && /^(existen|hay|surgen|aparecen)$/.test(l0)) return true;
  if (/^\p{Lu}\p{Ll}+(?:ar|er|ir)$/u.test(w0) && main(w.slice(1).join(" "))) return true;
  return commonWord(w0) && !START_VERB.has(l0) && !/mente$/.test(l0) && main(w.slice(1).join(" "));
}

// OCR: restos de reconocimiento («— Ss BIT», «a US RE», «¿AE», números sueltos) delatan una oración mal leída.
const ocrJunk = (t) => { const words = t.split(" "); return /[|<>=~^_\\{}#—]/.test(t) || /¿\p{Lu}{2}/u.test(t) || /\s\d{1,2}[.!?]$|\s\d\s\d\b|\s\d\s\p{Ll}\s/u.test(t) || /\p{Ll},?\s(?:Lo|La|El|Le|Los|Las|Se)\s/u.test(t)
  || words.slice(1).some((w) => /^\p{Lu}$/u.test(bare(w)) && !/^[AYOE]$/.test(bare(w)) || /^\p{Lu}{2,3}$/u.test(bare(w)) && !/^(UU|EE|ADN|ARN|IA|TIC|ONU|OMS|APA|PIB|EEUU|DSM|CI)$/.test(bare(w)) || /^\p{Lu}\p{Ll}?\p{Lu}/u.test(bare(w))); };
/** Hechos citables con su temática, el contexto previo del mismo apartado y, en esquemas, la lista o tabla a la que pertenecen. */
function buildFacts(files) {
  const facts = [];
  const midCaps = new Set();
  const pending = [];
  VOCAB = vocabOf(files);
  files.forEach((f, fi) => {
    const secs = f.sections.filter((s) => s.origin !== "visual" && !s.lowConfidence);
    const furniture = furnitureOf(secs);
    // Todo el documento seguido (con marcas de página) para que un párrafo pueda continuar en la página siguiente.
    const text = secs.map((s) => `\u0002${s.location}\n` + markTables(cleanLines(s, furniture)).join("\n")).join("\n");
    const stream = [];
    let heading = "", loc = secs[0]?.location || "", intro = null, introLeft = 0, slideStart = false, curOcr = false, np = null, explicit = false, meta = false, listNo = 0, listOpen = false;
    const originOf = new Map(secs.map((s) => [s.location, s.origin]));
    const paras = reflow(text).map((p) => (p && !p.startsWith("\u0001") && !p.startsWith("\u0002") ? tidy(p) : p));
    const topic = () => heading || cleanTopic(docTitle(f.name));
    const base = () => ({ doc: f.name, loc, topic: topic(), fi });
    const setHeading = (h) => { heading = h; intro = null; np = topicNP(h); explicit = false; meta = META_HEAD.test(h.replace(/^(?:\d{1,2}[.)]\s+)/, "")); };
    const pushTerm = (term, shown) => {
      stream.push({ t: shown, topic: topic(), self: true });
      if (!meta) pending.push({ ...base(), text: `${term.label}: ${term.desc}.`, term, si: stream.length - 1, stream });
      explicit = true;
    };
    paras.forEach((p, i) => {
      if (!p) { intro = null; return; }
      if (p.startsWith("\u0002")) { loc = p.slice(1); curOcr = originOf.get(loc) !== "native_text"; slideStart = /^Diapositiva/.test(loc) || curOcr; return; }
      if (p.startsWith("\u0001R\u0001")) {
        const [, , head, label, desc] = p.split("\u0001");
        const k = kindFromHead(head.split("\u0002"));
        // «Tipo | Para qué sirve» bajo «Tipos de entrevista:» → «tipo de entrevista».
        const ik = intro && kindFromIntro(intro);
        if (ik && normalize(ik.n).startsWith(normalize(k.n))) { k.n = ik.n; k.g = ik.g; }
        const d = tidy(proseOf(tidy(desc))).replace(/[.;]$/, "");
        if (!d || d.split(/\s+/).length < 2 || letterRatio(label) < 0.8) return;
        pushTerm({ label, name: label, desc: d, refs: false, person: false, generic: false, kind: k, table: true, clause: sentenceDesc(d) }, `${label}: ${d}.`);
        return;
      }
      const next = paras.slice(i + 1).find((x) => x && !x.startsWith("\u0002")) || "";
      // Tras «Se clasifican en función de su:», «1. Estructura», «2. Grado de dirección»… son elementos de la lista, no títulos
      // (hasta que la numeración vuelve a empezar).
      const num = +(p.match(/^(\d{1,2})[.)]\s/) || [])[1] || 0;
      if (listOpen && num && num === listNo + 1 && headingLike(p)) { listNo = num; stream.push({ t: p, topic: topic(), self: false }); return; }
      listOpen = false;
      if (headingLike(p) && !/:$/.test(p.trim())) {
        const nextOk = next.length >= 30 || parseTerm(next.replace(BULLET, "")) || next.startsWith("\u0001") || headingLike(next);
        if (slideStart || nextOk) { setHeading(cleanTopic(cleanHeading(curOcr ? p.replace(/\s*["“”\-–—]+\s*[\p{Lu}\-]{0,4}\s*$/u, "").replace(/(?:\s+\d{1,2})+$/, "").replace(/[,"“”]+$/, "") : p))); listNo = 0; }
        slideStart = false;
        return;
      }
      slideStart = false;
      let para = p.replace(BULLET, "");
      // Comilla decorativa al inicio del párrafo (diapositivas) sin su cierre.
      if (/^“/.test(para) && (para.match(/“/g) || []).length > (para.match(/”/g) || []).length) para = para.slice(1).trim();
      // «(Screening = "tamizaje": una revisión rápida…)»: una aclaración entre paréntesis que define un término.
      const aside = para.match(/^\(([^()=]{3,40}?)\s*=\s*([^()]+?)\.?\)$/);
      if (aside) {
        const x = tidy(aside[1]), y = tidy(aside[2]).replace(/[.;]$/, "");
        if (/^\p{Lu}/u.test(x) && x.split(/\s+/).length <= 4 && y.split(/\s+/).length >= 2) pushTerm({ label: x, name: x, desc: y, refs: false, person: false, generic: false, def: true }, `${x}: ${y}.`);
        return;
      }
      if (/^\(.*\)$/.test(para)) return;
      para = para.replace(/\s*\((?:p[áa]rr?|p[áa]gs?|pp?)\.\s*[\d\s,\-–y]+\)/gi, "");
      const dm = para.match(/^([^:]{2,60}):\s+(.+)$/);
      const date = dm && datePhrase(dm[1].trim());
      if (date) {
        const rest = dm[2].trim(), first = rest.split(/\s+/)[0] || "";
        // «Años 70, Guillaumin: contacto, administración y ruptura» (sin verbo) → entrada del autor con su fecha.
        if (date.who && !hasVerb(rest.replace(/\([^)]*\)/g, " "))) {
          const t2 = parseTerm(`${date.who}: ${rest}`);
          if (t2 && !t2.claim) { t2.person = true; t2.refs = false; t2.generic = false; t2.label = `${date.who} (${date.when.replace(/,.*$/, "").toLowerCase()})`; pushTerm(t2, para); return; }
        }
        // La mayúscula se conserva en nombres («1890: James Cattell…»), no en palabras comunes («Años 40: Comienzan…»).
        const fw = bare(first).toLowerCase();
        const keep = /^\p{Lu}/u.test(first) && !DET.test(fw) && !VERB_WORDS.has(normalize(fw)) && !START_VERB.has(fw) && !VOCAB.lower.has(normalize(fw));
        para = `${date.lead}, ${date.who ? date.who + " " : ""}${keep ? rest : lcFirst(rest)}`;
      } else {
        const term = curOcr ? null : parseTerm(para);
        // «Tipos de enlaces químicos:» + «Iónico: se forma por…» → «El enlace iónico se forma por…».
        const ik = term?.asSubject && intro && kindFromIntro(intro);
        if (ik?.pn && ADJ.test(term.asSubject.name)) { const n = singular(ik.pn); para = `${genderOf(n) === "f" ? "La" : "El"} ${n} ${lcFirst(term.asSubject.name)} ${term.asSubject.desc}.`; }
        else if (term?.claim) para = term.claim;
        else if (term) {
          if (/^(cap[ií]tulo|p[áa]gina|diapositiva|secci[oó]n|apartado)\b/i.test(term.name)) return;
          if (intro && introLeft-- > 0) { term.intro = intro; term.kind = kindFromIntro(intro); }
          term.desc = tidy(proseOf(term.desc));
          pushTerm(term, tidy(proseOf(para)));
          return;
        }
      }
      const sents = splitSentences(para);
      sents.forEach((raw, k) => {
        let t = raw.replace(/\s+/g, " ").trim();
        if (ADDITIVE.test(t)) t = ucFirst(t.replace(ADDITIVE, ""));
        // Una oración que termina en «:» abre una lista: sus elementos siguientes la llevan como contexto.
        if (/:$/.test(t) && k === sents.length - 1 && t.length < 160) { intro = t.replace(/:$/, ""); introLeft = 12; listNo = 0; listOpen = true; stream.push({ t, topic: topic(), self: selfStart(t) && hasVerb(t) && t.length >= 25 }); return; }
        if (META_SENT.test(t)) return;
        t = tidy(proseOf(t));
        if (/[.!?]$/.test(t) === false && date) t += ".";
        // Telegráfico: «4 etapas; conceptos: aprendizaje…» (nada con verbo antes ni después de los dos puntos), «A → B → C».
        const noPar = t.replace(/\([^)]*\)/g, " ");
        const mainOf = (x) => x.replace(/\b(?:que|quien|quienes|donde|cuando|cuyo|cuya|cuyos|cuyas)\b[^,;]*/gi, " ");
        if (/→/.test(t) || (/:/.test(noPar) && !hasVerb(noPar.split(":")[0]) && !hasVerb(mainOf(noPar.split(":").slice(1).join(":"))))) return;
        const r = resolveSubject(t, np, !explicit || (intro && k === 0));
        if (r.drop) return;
        t = r.text;
        // «El momento de la entrevista: el estilo varía…»: un elemento de lista con etiqueta depende de la frase que la abre.
        if (/^[^:]{3,60}:\s/.test(t) && !r.rewritten && intro) r.needsCtx = true;
        const self = !r.needsCtx && !ANAPHOR.test(t) && (r.rewritten || selfStart(t));
        if (!r.rewritten) explicit = true;
        if (t.length >= 12 && !(curOcr && ocrJunk(t))) stream.push({ t, topic: topic(), self });
        const words = t.split(" ");
        // Solo oraciones completas: terminan en punto, tienen extensión razonable, son texto y sus comillas y paréntesis cierran.
        if (meta || !/[.!?]$/.test(t) || t.length < 30 || t.length > 320 || words.length < 6 || letterRatio(t) < 0.75) return;
        if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length || (t.match(/[«“]/g) || []).length !== (t.match(/[»”]/g) || []).length || (t.match(/"/g) || []).length % 2 || /^[a-zñ]/.test(t)) return;
        if (curOcr && ocrJunk(t)) return;
        words.forEach((w, j) => { if (j > 0 && isCap(w)) midCaps.add(normalize(bare(w))); });
        pending.push({ ...base(), text: t, si: stream.length - 1, stream, needsCtx: !!r.needsCtx, rewritten: !!r.rewritten, original: r.rewritten ? raw.trim() : "" });
      });
      if (!/:$/.test(para) && (sents.length > 2 || para.length > 260 || --introLeft <= 0)) intro = null;
    });
  });
  pending.forEach((s) => {
    // Contexto: una o dos oraciones anteriores del mismo apartado (nunca de otro tema), aunque estén en la página anterior;
    // la primera debe entenderse sola (si también depende de otra, el hecho no se usa).
    const ctxOf = () => {
      const out = [];
      for (let j = s.si - 1; j >= 0 && out.length < 2; j--) {
        const e = s.stream[j];
        if (!e || e.topic !== s.topic) break;
        out.unshift(e);
        if (e.self && e.t.length >= 70) break;
      }
      return out.length && out[0].self ? out.map((e) => e.t).join(" ") : "";
    };
    const near = (k) => (s.stream[k] && s.stream[k].topic === s.topic ? s.stream[k].t : "");
    const ctx = { before: ctxOf(), after: near(s.si + 1) };
    const { stream, ...rest } = s;
    if (s.term) { facts.push({ ...rest, id: facts.length, subj: null, numbers: [], ctx }); return; }
    const subj = parseSubject(s.text, midCaps);
    // Una oración sin sujeto reconocible ni verbo es un fragmento: no sirve para preguntar.
    if (!subj && !hasVerb(s.text)) return;
    if (subj && s.rewritten) subj.derived = true;
    // También dependen de la anterior las que remiten a algo ya dicho («el símbolo de este periodo», «lo ven como…»).
    const anaphoric = s.needsCtx || (!subj && !s.rewritten && !selfStart(s.text)) || ANAPHOR.test(s.text) || !!subj?.cliticRef || /\b(este|esta|estos|estas|ese|esa|esos|esas|dicho|dicha|dichos|dichas|aquel|aquella)\s+\p{L}/iu.test(s.text)
      || /\b(lo anterior|los anteriores|las anteriores|mencionad[oa]s? (anteriormente|antes)|ya mencionad[oa]s?|citad[oa]s? anteriormente|desde entonces|a partir de entonces)\b/i.test(s.text);
    if (anaphoric && !ctx.before) return;
    // Cifras de la prosa; los años de las citas («Sternberg (1998)») y las páginas no son datos que estudiar.
    const prose = s.text.replace(/\([^)]*\)/g, " ").replace(/\b(?:p[áa]gs?|pp?)\.\s*\d+/gi, " ");
    facts.push({ ...rest, id: facts.length, subj, numbers: prose.match(NUM) || [], anaphoric, ctx });
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
  const c = contextOf(f);
  const t = f.term?.intro ? `El apunte dice (${lcFirst(f.term.intro)}): “${f.text}”` : `El apunte dice: “${c ? c + " " : ""}${f.text}”`;
  return `${t}\nFuente: «${f.doc}» · ${f.loc}.`;
}
// Contexto que necesita un hecho para entenderse solo: las oraciones anteriores si remite a ellas («Esta obra…», «lo ven como…»),
// o la frase que abre la lista a la que pertenece («Cattell define 3 tipos de rasgos»).
const contextOf = (f) => (f.anaphoric && f.ctx?.before ? f.ctx.before : f.term?.intro && !f.term.person ? f.term.intro : "");
const lead = (f) => { const c = contextOf(f); return c ? `Contexto: «${stripEnd(c)}».\n` : ""; };
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
function numericVariants(raw, avoid = [], text = "") {
  const dec = raw.includes(",") ? "," : ".";
  const n = parseFloat(raw.replace(",", "."));
  const isInt = Number.isInteger(n);
  // «Años 70», «década de 1990»: otras décadas, no 71 ni 69.
  if (isInt && n % 10 === 0 && new RegExp(`(?:a[ñn]os|d[ée]cada de(?:l)?)\\s+${raw}\\b`, "i").test(text)) return [n - 10, n + 10, n - 20, n + 20, n - 30].filter((x) => x > 0 && (n < 100 ? x < 100 : true)).map(String).filter((x) => !avoid.includes(x));
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
  let w = String(t).replace(/\s*\([^)]*\)/g, "").replace(/[«»"“”]/g, "").replace(new RegExp(BLANK, "g"), " ").split(/\s+/).filter(Boolean);
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
  const t = f.term;
  if (t?.person) return { n: "autor", g: "m" };
  if (t?.kind) return t.kind;
  if (t?.def) return { n: "término", g: "m" };
  if (t?.refs) return { n: "categoría", g: "f" };
  // El título nombra la clase solo si empieza por ella («Pasos para la entrevista» → «paso»; «Evaluación por etapas» no).
  const first = normalize(f.topic.replace(/^(?:\d{1,2}[.)]\s+|[A-Z]\)\s+)/, "")).split(" ")[0];
  const hit = KINDS[first] || (/etimolog/i.test(f.topic) ? ["término", "m"] : ["concepto", "m"]);
  return { n: hit[0], g: hit[1] };
}
const art = (k, cap = false) => (k.g === "f" ? (cap ? "La" : "la") : cap ? "El" : "el");
// Minúscula inicial de una descripción, salvo nombres propios y siglas («WISC-IV para México»).
const lcDesc = (d) => { const w0 = bare(d.split(/\s+/)[0] || ""); return !DET.test(w0) && (isAcronym(w0) || properWord(w0) || /^\p{Lu}[\p{L}]*\s+\p{Lu}/u.test(d)) ? d : lcFirst(d); };
// La descripción es una oración con sujeto propio («El problema tiene que ver con…»).
const sentenceDesc = (d) => /^\p{Lu}/u.test(d) && !/^\p{Lu}\p{Ll}+(?:ar|er|ir)\b/u.test(d) && !startsVerb(d)
  && hasVerb(d.replace(/\([^)]*\)/g, " ").split(";")[0].replace(/\b(?:que|quien|quienes|donde|cuyo|cuya)\b[^,;]*/gi, " "));
const infinitiveDesc = (d) => /^\p{L}\p{Ll}+(?:ar|er|ir)(?:se|la|lo|las|los|le|les)?\b/u.test(d) && !/^(?:par|lugar|mujer|hogar|nivel|azar)\b/i.test(d);
// Si el nombre ya dice la clase («Período psicométrico»), no se repite («el período «Período psicométrico»»).
const hasKind = (f, k) => normalize(f.term.name).split(" ").includes(normalize(k.n.split(" ")[0]));
const termNP = (f) => {
  const k = termKind(f), last = k.n.split(" ").pop();
  if (f.term.person) return f.term.label;
  if (hasKind(f, k)) return `«${f.term.name}»`;
  // «Entrevista de alta clínica» ya dice que es una entrevista: «la «Entrevista de alta clínica»», no «el tipo de entrevista «…»».
  if (normalize(f.term.name.split(" ")[0]) === normalize(last)) return `${genderOf(last) === "f" ? "la" : "el"} «${f.term.name}»`;
  return `${art(k)} ${k.n} «${f.term.name}»`;
};
/**
 * Afirmación completa de una entrada de esquema, de tabla o de un autor, con la descripción dada
 * (la propia o la de otra entrada para una falsa). Con blank, el nombre queda como hueco.
 */
function termStmt(f, desc, blank = false) {
  const t = f.term, k = termKind(f);
  const name = blank ? BLANK : `«${t.name}»`;
  const np = blank ? (hasKind(f, k) ? BLANK : `${art(k)} ${k.n} ${BLANK}`) : termNP(f);
  const d = lcDesc(desc);
  if (t.refs) return contract(`A ${np} ${t.tests ? "corresponden estas pruebas u obras" : "se asocian estos autores u obras"}: ${desc}.`);
  if (t.person) return `${blank ? BLANK : t.label} ${t.quote ? "afirma" : "se asocia con"}: ${desc}.`;
  if (t.def || k.n === "término" || t.kind?.attr === "significado") return `${name} significa ${/^(el|la|los|las|un|una)\s/i.test(desc) && hasVerb(desc) ? "que " : ""}${d}.`;
  if (t.seq) return `${ucFirst(np)} sigue esta secuencia: ${desc}.`;
  const v = t.kind?.verb || "";
  // «Termina el proceso y despide al paciente» (sin sujeto): el sujeto es la entrada.
  if (startsVerb(ucFirst(desc)) && !/^(se\s+(?:lo|la|los|las|le|les)|es decir)\b/i.test(desc)) return `${ucFirst(np)} ${d}.`;
  if (sentenceDesc(desc) || (desc === t.desc && t.clause)) {
    // «Perspectiva cibernética: el sistema nervioso se asimila…» → «Según la perspectiva cibernética, el sistema nervioso…».
    const w0 = t.name.split(/\s+/)[0];
    if (!t.kind && !blank && !properWord(w0) && !isAcronym(w0)) return `Según ${genderOf(w0) === "f" ? "la" : "el"} ${lcFirst(t.name)}, ${d}.`;
    return contract(`En ${np}, ${d}.`);
  }
  if (infinitiveDesc(desc)) return `${ucFirst(np)} ${v === "sirve para" ? "sirve para" : "consiste en"} ${d}.`;
  if (v === "es") return `${ucFirst(np)} es: ${d}.`;
  if (v && !/^(hace|pasa|ocurre|sirve para)$/.test(v)) return `${ucFirst(np)} ${v}: ${d}.`;
  if (t.kind?.attr) return `${ucFirst(np)} tiene ${genderOf(t.kind.attr) === "f" ? "esta" : "este"} ${t.kind.attr}: ${d}.`;
  if (/^(c[oó]mo|qu[eé]|cu[aá]ndo|d[oó]nde|qui[eé]n|cu[aá]l|lo que|si)\b/i.test(desc)) return `${ucFirst(np)} se refiere a ${d}.`;
  if ((desc.replace(/\([^)]*\)/g, "").match(/,/g) || []).length >= 2 && !hasVerb(desc.replace(/\([^)]*\)/g, " "))) return `${ucFirst(np)} comprende: ${d}.`;
  if (t.kind) return `${ucFirst(np)} se caracteriza así: ${d}.`;
  return `${ucFirst(np)} se define como: ${d}.`;
}
// Pregunta por el nombre a partir de la descripción: «¿En qué ámbito el problema tiene que ver con…?», «¿Qué autor afirma lo siguiente?».
function termAskName(f) {
  const t = f.term, k = termKind(f), d = t.desc;
  if (t.refs) return `¿A qué ${k.n} corresponden ${t.tests ? "estas pruebas u obras" : "estos autores u obras"}?\n«${d}»`;
  if (t.person) return t.quote ? `¿Qué autor afirma lo siguiente?\n${d}` : `¿Qué autor se asocia con lo siguiente?\n«${d}»`;
  if (t.def || k.n === "término") return `¿Qué término significa lo siguiente?\n«${d}»`;
  if (t.table && sentenceDesc(d)) return `¿En qué ${k.n} ${lcDesc(d)}?`;
  return `¿Qué ${k.n} corresponde a esta descripción?\n«${d}»`;
}
// Pregunta por la descripción: «¿Qué pasa en el ámbito «Clínico»?», «¿Para qué sirve el tipo de entrevista «Screening»?».
function termAskDesc(f) {
  const t = f.term, k = termKind(f), v = t.kind?.verb || "";
  if (t.refs) return contract(t.tests ? `¿Qué pruebas u obras corresponden a ${termNP(f)}?` : `¿Qué autores u obras se asocian a ${termNP(f)}?`);
  if (t.person) return `¿Con qué idea o aporte se asocia a ${t.label}?`;
  if (t.def || k.n === "término") return `¿Qué significa ${termNP(f)}?`;
  if (v === "sirve para") return `¿Para qué sirve ${termNP(f)}?`;
  if (v) return contract(`¿Qué ${v} en ${termNP(f)}?`).replace(/^¿Qué es en /, "¿Qué es ");
  if (t.seq) return `¿Qué secuencia sigue ${termNP(f)}?`;
  if (infinitiveDesc(t.desc)) return `¿En qué consiste ${termNP(f)}?`;
  return contract(`¿Qué caracteriza a ${termNP(f)}?`);
}
// Pregunta abierta para una entrada genérica («Ambiente:», «Técnicas:»): «¿Qué se señala sobre el ambiente en la entrevista?».
function genericAsk(f) {
  const t = f.term, w0 = t.name.split(/\s+/)[0], np = topicNP(f.topic);
  const plural = /[^s]s$/i.test(w0) && !/(?:is|us)$/i.test(w0), g = genderOf(singular(w0.toLowerCase()));
  const what = /^\p{Lu}\p{Ll}/u.test(w0) && !/^(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/i.test(w0) && !properWord(w0)
    ? `${plural ? (g === "f" ? "las" : "los") : g === "f" ? "la" : "el"} ${lcFirst(t.name)}` : `«${t.name}»`;
  const where = np ? `en ${np.np}` : `en relación con «${cleanTopic(f.topic).replace(/^(?:\d{1,2}[.)]\s+)/, "")}»`;
  if (/^(otros|otras)$/i.test(t.name)) return contract(`¿Qué ${t.name.toLowerCase()} elementos se mencionan ${where}?`);
  if (plural && /^\p{Lu}\p{Ll}/u.test(w0) && !properWord(w0)) return contract(`¿Qué ${lcFirst(t.name)} se mencionan ${where}?`);
  return contract(`¿Qué se señala sobre ${what} ${where}?`);
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
  // Entradas comparables: misma clase (filas de la misma tabla, elementos de la misma lista, autores con autores…), primero del mismo tema.
  const kindKey = (x) => (x.term.person ? "autor" : x.term.refs ? "refs" : x.term.def ? "término" : termKind(x).n + (x.term.table ? "|tabla" : ""));
  // Forma de la descripción: con verbo inicial, oración, infinitivo o frase nominal (una falsa debe tener la misma forma).
  const shapeOf = (d) => (startsVerb(ucFirst(d)) ? "v" : sentenceDesc(d) ? "s" : infinitiveDesc(d) ? "i" : "n");
  const termPeers = (f) => {
    const list = terms.filter((x) => x.fi === f.fi && x.id !== f.id && !x.term.generic && kindKey(x) === kindKey(f)
      && !overlaps(x.term.label, f.term.label) && normalize(x.term.desc) !== normalize(f.term.desc));
    const close = (x) => (x.term.intro && x.term.intro === f.term.intro ? 2 : 0) + (x.topic === f.topic ? 1 : 0);
    return shuffle(list).sort((a, b) => close(b) - close(a));
  };
  const focusOf = (f) => {
    const t = f.term ? f.term.name : f.subj ? ucFirst(f.subj.npText) : nounPhrase(f.text);
    return t && !overlaps(t, cleanTopic(f.topic).replace(/^(?:\d{1,2}[.)]\s+)/, "")) ? ucFirst(t) : "";
  };
  // Afirmaciones que pueden ir en «¿cuál es correcta / incorrecta?»: completas por sí solas (sin entradas genéricas).
  const stmtOk = (g) => !g.anaphoric && !(g.term && (g.term.generic || g.term.attrib)) && stmt(g).length <= 230;
  const base = (f, type) => ({ id: uid(), type, topic: f.topic, focus: focusOf(f), fact: factKey(f), explanation: cite(f), source: { doc: f.doc, loc: f.loc } });

  // Formas de convertir un hecho en una afirmación falsa pero plausible (cada una con su porqué).
  const falsesOf = (f, mode = "any") => {
    const out = [];
    if (f.term && !f.term.generic) {
      const pick = termPeers(f).find((x) => shapeOf(x.term.desc) === shapeOf(f.term.desc) && (!f.term.clause || x.term.clause));
      if (pick) out.push({ text: termStmt(f, pick.term.desc), focus: f.term.name, why: `Eso corresponde a «${pick.term.name}». Lo correcto es: ${termStmt(f, f.term.desc)}` });
      return out;
    }
    if (f.numbers.length) {
      const n = f.numbers[0], v = numericVariants(n, f.numbers, f.text)[0];
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
    if (/\bno\s+(es|son|tiene|tienen|requiere|requieren|puede|pueden|presenta|presentan)\b/.test(f.text) && !/\bsí\b|\bsino\b/i.test(f.text))
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
        if (!f.subj || f.subj.derived) return null;
        const opts = optionsWith(f.subj.npText, peers(f, { order: d === "easy" ? "far" : "near" }).map((x) => x.subj.npText));
        if (!opts) return null;
        const stem = f.subj.prefix ? `${f.subj.prefix}${BLANK} ${f.subj.pred}` : `${BLANK} ${f.subj.pred}`;
        return { ...base(f, "multiple_choice"), prompt: `${lead(f)}¿Qué ${f.subj.proper && !f.subj.det ? "autor o personaje" : "concepto"} completa correctamente esta afirmación?\n«${stem}»`, options: opts, answerIndex: opts.indexOf(ucFirst(f.subj.npText)),
          explanation: `La respuesta correcta es «${f.subj.npText}».\n${cite(f)}` };
      },
      termLabel(f) {
        if (!f.term || f.term.generic) return null;
        const opts = optionsWith(f.term.person ? f.term.label : f.term.name, termPeers(f).map((x) => (x.term.person ? x.term.label : x.term.name)));
        if (!opts) return null;
        const right = f.term.person ? f.term.label : f.term.name;
        return { ...base(f, "multiple_choice"), prompt: lead(f) + termAskName(f), options: opts, answerIndex: opts.indexOf(ucFirst(right)), explanation: `La respuesta correcta es «${right}».\n${cite(f)}` };
      },
      termDesc(f) {
        if (!f.term || f.term.generic || f.term.desc.length > 150) return null;
        const others = termPeers(f).filter((x) => x.term.desc.length <= 150).map((x) => x.term.desc);
        const opts = optionsWith(f.term.desc, others);
        if (!opts) return null;
        return { ...base(f, "multiple_choice"), prompt: lead(f) + termAskDesc(f), options: opts, answerIndex: opts.indexOf(ucFirst(f.term.desc)), explanation: `La respuesta correcta es: ${f.term.desc}.\n${cite(f)}` };
      },
      number(f) {
        if (!f.numbers.length) return null;
        const n = f.numbers[f.numbers.length > 1 && d === "jacqueline" ? 1 : 0];
        const vars = numericVariants(n, f.numbers, f.text).slice(0, nOpts - 1);
        if (vars.length < nOpts - 1) return null;
        const opts = shuffle([n, ...vars]);
        return { ...base(f, "multiple_choice"), prompt: `${lead(f)}¿Qué dato exacto completa esta afirmación?\n«${replaceOnce(f.text, n, BLANK)}»`, options: opts, answerIndex: opts.indexOf(n),
          explanation: `El dato correcto es ${n}.\n${cite(f)}` };
      },
      // Difícil: una sola afirmación correcta entre versiones alteradas de otros hechos del mismo documento.
      correctStatement(f) {
        if (!stmtOk(f)) return null;
        const pool = shuffle(facts.filter((g) => g.fi === f.fi && g.id !== f.id && stmtOk(g))).sort((a, b) => (b.topic === f.topic) - (a.topic === f.topic));
        const wrong = [], whys = [];
        const usedD = new Set(f.term ? [normalize(f.term.desc)] : []);
        for (const g of pool) {
          const x = falsesOf(g)[0];
          const dk = g.term ? normalize(termPeers(g).find((y) => x && x.text.includes(y.term.desc))?.term.desc || x?.text || "") : "";
          if (x && !wrong.includes(x.text) && !(dk && usedD.has(dk)) && !(f.term && x.text.includes(f.term.desc))) { wrong.push(x.text); if (dk) usedD.add(dk); whys.push(`• “${stripEnd(x.text)}”: ${x.why}`); }
          if (wrong.length >= nOpts - 1) break;
        }
        if (wrong.length < 2) return null;
        const opts = shuffle([stmt(f), ...wrong]);
        return { ...base(f, "multiple_choice"), focus: "", prompt: "¿Cuál de las siguientes afirmaciones es correcta?", options: opts, answerIndex: opts.indexOf(stmt(f)),
          explanation: `La correcta es: “${stripEnd(stmt(f))}”.\nLas demás alteran el apunte:\n${whys.join("\n")}\nFuente: «${f.doc}» · ${f.loc}.` };
      },
      // Jacqueline: la única afirmación INCORRECTA entre hechos verdaderos de otros temas o documentos.
      incorrectStatement(f) {
        const x = falsesOf(f)[0];
        if (!x || !stmtOk(f)) return null;
        const pool = shuffle(facts.filter((g) => g.id !== f.id && stmtOk(g) && (g.topic !== f.topic || g.fi !== f.fi)));
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
        if (f.term?.generic || f.term?.attrib) return null;
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
        if (!stmtOk(f) || f.term || f.text.length > 200) return null;
        const others = shuffle(facts.filter((x) => x.id !== f.id && stmtOk(x) && !x.term && x.topic !== f.topic && x.text.length < 200));
        const g = others.find((x) => x.fi === f.fi) || others[0];
        if (!g || f.text.length > 200) return null;
        const alter = Math.random() < 0.55, target = Math.random() < 0.5 ? f : g, x = alter ? falsesOf(target)[0] : null;
        const A = x && target === f ? x.text : f.text, B = x && target === g ? x.text : g.text;
        const fx = (h) => focusOf(h) || (h.subj ? ucFirst(h.subj.npText) : cleanTopic(h.topic).replace(/^(?:\d{1,2}[.)]\s+)/, ""));
        return { ...base(f, "true_false"), focus: `${fx(f)} y ${lcDesc(fx(g))}`, prompt: `${stripEnd(A)}; además, ${lcDesc(B)}`, answerBool: !x,
          explanation: x ? `Es falsa: una de las dos partes está alterada. ${x.why}\n${cite(target)}` : `Es verdadera: las dos partes coinciden con el apunte.\n${cite(f)}\n${cite(g)}` };
      },
    },

    fill_blank: {
      subject(f) {
        if (!f.subj || f.subj.derived) return null;
        return { ...base(f, "fill_blank"), prompt: lead(f) + replaceOnce(f.text, f.subj.noun, BLANK), answers: [[...new Set([f.subj.noun, f.subj.npText])]], hints: [subjHint(f)],
          explanation: `La respuesta es «${f.subj.noun}».\n${cite(f)}` };
      },
      term(f) {
        if (!f.term || f.term.generic) return null;
        const k = termKind(f), t = f.term;
        return { ...base(f, "fill_blank"), prompt: lead(f) + ucFirst(termStmt(f, t.desc, true)), answers: [[...new Set([t.name, t.label])]], hints: [t.person ? "autor" : contract(`nombre de ${art(k)} ${k.n}`)], explanation: `La respuesta es «${t.name}».\n${cite(f)}` };
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
          return { ...base(f, "fill_blank"), prompt: termStmt(f, replaceOnce(f.term.desc, who, BLANK), true), answers: [[...new Set([f.term.name, f.term.label])], [who]], hints: [contract(`nombre de ${art(k)} ${k.n}`), f.term.tests ? "prueba u obra" : "autor"],
            explanation: `Respuestas: «${f.term.name}» y «${who}».\n${cite(f)}` };
        }
        if (!f.subj || f.subj.proper || f.subj.derived) return null;
        const second = f.numbers[0] || keyword(f);
        if (!second) return null;
        let prompt = replaceOnce(f.text, f.subj.noun, BLANK);
        if (!prompt.includes(second)) return null;
        prompt = replaceOnce(prompt, second, BLANK);
        return { ...base(f, "fill_blank"), prompt: lead(f) + prompt, answers: [[...new Set([f.subj.noun, f.subj.npText])], [second]], hints: [subjHint(f), /^\d/.test(second) ? "cifra" : "palabra clave"], explanation: `Respuestas: «${f.subj.noun}» y «${second}».\n${cite(f)}` };
      },
      // Jacqueline: tres huecos (concepto, cifra y palabra clave).
      threeBlank(f) {
        if (!f.subj || f.subj.proper || f.subj.derived || !f.numbers.length) return null;
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
          const t = f.term;
          const prompt = t.attrib ? `¿Qué plantea ${genderOf(t.name.split(/\s+/)[0]) === "f" ? "la" : "el"} ${lcFirst(t.label)}?`
            : t.generic ? genericAsk(f)
            : t.refs || t.person ? termAskDesc(f) : `${termAskDesc(f)} Explícalo con tus palabras.`;
          const kp = t.refs ? refNames(t.desc).slice(0, 4) : keyIdeas(t.desc, 4);
          return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
        }
        if (!f.subj) return null;
        const s = f.subj, np = npLower(s);
        const src = sourceOf(s);
        const prompt = s.def ? `¿Qué ${s.copula} ${np}?` : src ? `¿Qué afirma ${src} sobre ${np}?` : s.proper && !s.det ? (s.prefix ? `¿Qué hizo ${np}${prefixPhrase(s)}?` : `¿Qué hizo ${np} y por qué es relevante?`) : contract(`¿Qué caracteriza a ${np}${prefixPhrase(s)}?`);
        const kp = keyIdeas(card(f), 4, s.noun);
        return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
      },
      explain(f) {
        if (!f.subj) return this.define(f);
        const s = f.subj, np = npLower(s);
        const prompt = s.def ? `Explica con tus palabras qué ${s.copula} ${np} y qué características ${s.plural ? "tienen" : "tiene"}.`
          : sourceOf(s) ? `Explica qué afirma ${sourceOf(s)} sobre ${np} y qué datos concretos aporta.`
          : contract(`Explica qué se sabe de ${np}${prefixPhrase(s)}, con datos concretos.`);
        const kp = keyIdeas(card(f), 4, s.noun);
        return kp.length ? { ...base(f, "open"), prompt, modelAnswer: card(f), keyPoints: kp } : null;
      },
      // Difícil: relacionar dos conceptos del mismo tema.
      relate(f, across = false) {
        if (f.term && !f.term.generic) {
          const pair = termPeers(f).find((x) => (across ? x.topic !== f.topic : x.topic === f.topic));
          if (!pair) return null;
          const t = f.term;
          const prompt = t.refs ? `¿Qué autores u obras corresponden a «${t.name}» y cuáles a «${pair.term.name}»? Explica en qué se diferencian.`
            : t.person ? `¿Con qué idea o aporte se asocia a ${t.label} y con cuál a ${pair.term.label}? Compáralos.`
            : `Compara ${termNP(f)} con ${termNP(pair)}: ¿qué caracteriza a cada uno y en qué se diferencian?`;
          return { ...base(f, "open"), focus: `${t.name} y ${pair.term.name}`, prompt, modelAnswer: `${card(f)}\n${card(pair)}`,
            keyPoints: t.refs ? [...refNames(t.desc).slice(0, 2), ...refNames(pair.term.desc).slice(0, 2)] : [...keyIdeas(t.desc, 2), ...keyIdeas(pair.term.desc, 2)], explanation: `${cite(f)}\n${cite(pair)}` };
        }
        if (!f.subj || f.subj.prefix) return null;
        const s = f.subj, np = npLower(s), headWord = normalize(s.noun.split(" ")[0]);
        const shared = (x) => { const A = new Set(contentWords(f.text).filter((w) => !GENERIC.has(w))); return contentWords(x.text).filter((w) => A.has(w) && !normalize(f.subj.noun).includes(w)).length; };
        const cands = shuffle(withSubj.filter((x) => !x.subj.prefix && !sameConcept(x, f) && (across ? x.topic !== f.topic && shared(x) >= 2 : x.fi === f.fi && x.topic === f.topic)));
        const pair = cands.find((x) => normalize(x.subj.noun.split(" ")[0]) === headWord) || cands.sort((a, b) => shared(b) - shared(a)).find((x) => shared(x) >= 1);
        if (!pair) return null;
        const other = npLower(pair.subj), comparable = normalize(pair.subj.noun.split(" ")[0]) === headWord;
        const prompt = across
          ? `Relaciona ${np} con ${other}: ¿qué los conecta y en qué se diferencian? Apóyate en datos concretos.`
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
          // El título se ve sobre la pregunta: la respuesta de selección o completar no puede estar en él.
          const shownTopic = normalize(cleanTopic(f.topic));
          const answersOf = q.type === "multiple_choice" ? [q.options[q.answerIndex]] : q.type === "fill_blank" ? q.answers.map((x) => x[0]) : [];
          if (answersOf.some((x) => String(x).length <= 60 && contentWords(x).length && new RegExp(`(^| )${normalize(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(shownTopic))) continue;
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
