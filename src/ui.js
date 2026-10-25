/* =====================================================================
   StudyMaster AI — interfaz (React + htm)
   ===================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const html = htm.bind(React.createElement);

const ICONS = {
  plus: "M12 5v14M5 12h14", trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3", menu: "M4 6h16M4 12h16M4 18h16",
  x: "M6 6l12 12M18 6L6 18", upload: "M12 16V4M7 9l5-5 5 5M4 20h16", check: "M5 12l5 5L20 7",
  sun: "M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z", auto: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4", logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  spark: "M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z", arrow: "M5 12h14M13 6l6 6-6 6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7", file: "M6 3h8l4 4v14H6zM14 3v4h4", cpu: "M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12h.01", bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  chart: "M4 20V11M10 20V5M16 20v-6M3 20h18", clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z", folder: "M3 6h6l2 2h10v11H3z",
};
const Icon = ({ name, size = 18, stroke = 2 }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;
const Spinner = () => html`<span className="spin" aria-hidden="true"></span>`;

function Brand({ small }) {
  return html`<div className="flex items-center gap-2 select-none">
    <span className=${"grid place-items-center rounded-lg flat tone-butter " + (small ? "w-7 h-7" : "w-9 h-9")} style=${{ boxShadow: "2px 2px 0 rgb(var(--line))" }}>
      <svg width=${small ? 15 : 19} height=${small ? 15 : 19} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 19l7-14 2 4M9 15h8l3 4" /></svg>
    </span>
    <span className=${"font-extrabold tracking-tight " + (small ? "text-[17px]" : "text-xl")} style=${{ fontFamily: "var(--font-display)" }}>StudyMaster<span className="ml-1 px-1.5 rounded-md text-[0.72em] align-[2px]" style=${{ background: "rgb(var(--accent))", color: "rgb(var(--accent-ink))" }}>AI</span></span>
  </div>`;
}

// ================================================================ acceso
// Pantalla de bienvenida: explica la página en lenguaje sencillo y pide solo un nombre o apodo.
// Los modos de estudio (Gemini, Claude, demo, API key) se eligen después, en la pantalla de trabajo.
const FEATURES = [
  ["upload", "sky", "Sube lo que tengas", "PDF, Word, PowerPoint, Google Docs, Canva y fotos de tus cuadernos. Sin límite de archivos: puedes arrastrar carpetas completas."],
  ["eye", "mint", "Lee hasta tu letra", "Saca el texto de documentos, imágenes y fotos de la pizarra. Con IA entiende también los apuntes escritos a mano."],
  ["list", "lav", "Cuatro tipos de pregunta", "Selección múltiple, verdadero o falso, completar y pregunta abierta. Combina hasta tres en un mismo test."],
  ["target", "peach", "Tú eliges el nivel", "Fácil, Medio, Difícil o Jacqueline, el más exigente. También decides cuántas preguntas quieres."],
  ["bolt", "butter", "Corrección al momento", "En selección y verdadero o falso sabes al instante si acertaste. En completar y abiertas ves la respuesta del documento y te autoevalúas, o la IA te corrige."],
  ["chart", "rose", "Resultados claros", "Nota, porcentaje, aciertos por tipo de pregunta y repaso completo. Repite el mismo test o pide preguntas nuevas."],
  ["clock", "sky", "Historial como chats", "Cada sesión de estudio queda guardada en la barra lateral para retomarla cuando quieras."],
  ["shield", "mint", "Sin servidor propio", "Tus archivos se leen en tu navegador y tus keys solo se guardan ahí. Con modo claro y oscuro."],
];
const STUDY_MODES = [
  ["spark", "sky", "With Gemini", true, "Conecta gratis tu cuenta de Google. Lee imágenes y letra a mano, redacta las preguntas y corrige tus respuestas."],
  ["user", "lav", "Cuenta de Claude", true, "Abre StudyMaster dentro de claude.ai con tu propia cuenta, sin API key. Tu historial queda en la nube."],
  ["file", "butter", "Demo local", false, "Sin IA y sin cuenta: todo ocurre en tu navegador. Funciona mejor con Word, PDF o archivos de texto."],
  ["cpu", "peach", "Tu API key", false, "¿Ya tienes una key? Úsala con Gemini, Llama (vía Groq) o Grok (xAI)."],
];
const HOW = [["Sube tus apuntes", "Archivos, carpetas o fotos."], ["Configura tu test", "Tipos de pregunta, nivel y cantidad."], ["Responde y repasa", "Corrección, nota y repaso completo."]];

const IconTile = ({ name, tone, size = 20, className = "" }) => html`<span className=${"icon-tile tone-" + tone + " " + className}><${Icon} name=${name} size=${size} /></span>`;

// Vista previa ilustrativa de una pregunta (decorativa, solo en pantallas anchas).
const HeroPreview = () => html`<div className="hero-preview hidden 2xl:block" aria-hidden="true">
  <div className="card q-card p-5 flex flex-col gap-3">
    <div className="flex items-center gap-2"><span className="pill tone-lav">Selección múltiple</span><span className="ml-auto eyebrow">3 / 10</span></div>
    <div className="flex items-center gap-2"><span className="eyebrow">Temática</span><b style=${{ fontFamily: "var(--font-display)" }}>La célula</b></div>
    <p className="font-bold leading-snug" style=${{ fontFamily: "var(--font-display)" }}>¿A qué orgánulo corresponde esta afirmación? «____ produce la mayor parte del ATP de la célula.»</p>
    ${[["A", "El núcleo", ""], ["B", "La mitocondria", "is-correct"], ["C", "El ribosoma", ""]].map(([k, t, c]) => html`<div key=${k} className=${"option !text-[15px] !py-2.5 " + c}><span className="key">${k}</span>${t}</div>`)}
    <p className="rounded-xl p-2.5 text-sm verdict-ok"><b>¡Correcto!</b> Según tus apuntes, página 2.</p>
  </div>
  <div className="hero-badge flat tone-butter"><span className="mono text-2xl font-bold">92%</span><span className="text-xs font-bold">Dominio total</span></div>
</div>`;

function LoginScreen({ onChoose, notice }) {
  const [nick, setNick] = useState(pref.get("smai:nick", ""));
  const muted = { color: "rgb(var(--muted))" };
  const enter = (e) => {
    e.preventDefault();
    pref.set("smai:nick", nick.trim());
    onChoose({ mode: "guest", nick: nick.trim() });
  };
  const pad = "px-4 sm:px-8 lg:px-12 xl:px-16";
  return html`<div className="landing grid lg:grid-cols-[minmax(0,1fr)_clamp(380px,34vw,520px)] min-h-full">
    <section className=${"lg:col-start-1 lg:row-start-1 flex flex-col gap-10 pt-6 pb-10 lg:pt-8 " + pad}>
      <div className="flex items-center justify-between gap-3">
        <${Brand} />
        <span className="pill tone-mint hidden sm:inline-flex">Gratis · sin instalar nada</span>
      </div>
      <div className="grid 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-10 items-center">
      <div className="flex flex-col gap-5 max-w-[46rem]">
        <div className="eyebrow flex items-center gap-2"><span className="w-2 h-2 rounded-full" style=${{ background: "rgb(var(--accent))" }}></span>Tu espacio de estudio</div>
        <h1 className="text-[2.4rem] sm:text-[3.2rem] xl:text-[3.9rem] leading-[1.02] font-extrabold">Convierte tus apuntes en <span className="marker">exámenes</span> que de verdad enseñan.</h1>
        <p className="text-[17px] max-w-[40rem]" style=${muted}>Sube tus documentos o fotos de tus cuadernos y StudyMaster te prepara un test con preguntas sacadas de tu propio material, como lo haría tu profesor más exigente.</p>
        <div className="flex flex-wrap gap-2">
          ${MODE_KEYS.map((m) => html`<span key=${m} className=${"chip tone-" + MODES[m].tone}>${MODES[m].label}</span>`)}
          <span className="chip jq-badge" style=${{ border: 0 }}>♛ Nivel Jacqueline</span>
        </div>
      </div>
      <${HeroPreview} />
      </div>
      <ol className="grid sm:grid-cols-3 gap-3" aria-label="Cómo funciona">
        ${HOW.map(([t, d], i) => html`<li key=${t} className="how-step">
          <span className="how-num mono">${i + 1}</span>
          <span className="min-w-0"><b className="block leading-tight" style=${{ fontFamily: "var(--font-display)" }}>${t}</b><span className="text-sm" style=${muted}>${d}</span></span>
        </li>`)}
      </ol>
    </section>

    <aside className="landing-access lg:col-start-2 lg:row-start-1 lg:row-span-2">
      <div className="lg:sticky lg:top-0 lg:h-dvh flex flex-col justify-center gap-5 px-4 sm:px-8 py-8 lg:px-10">
        <form className="access-card flex flex-col gap-4" onSubmit=${enter}>
          <div>
            <div className="eyebrow">Acceso</div>
            <h2 className="text-[1.75rem] leading-tight font-extrabold mt-1">¡Hola! ¿Cómo te llamas?</h2>
            <p className="text-sm mt-1" style=${muted}>Escribe tu nombre o apodo para personalizar tu espacio de estudio.</p>
          </div>
          ${notice && html`<p className="rounded-xl p-3 text-sm tone-peach">${notice}</p>`}
          <label htmlFor="nick" className="text-sm font-bold -mb-2">Nombre o apodo <span className="font-normal" style=${muted}>(opcional)</span></label>
          <input id="nick" className="field !py-3 !text-base" placeholder="Ej. Ana" autoComplete="nickname" value=${nick} maxLength="40" onInput=${(e) => setNick(e.target.value)} />
          <button type="submit" className="btn btn-primary w-full !py-4 !text-lg">Acceder <${Icon} name="arrow" /></button>
          <p className="text-sm" style=${muted}>Después de acceder eliges cómo estudiar: <b>With Gemini</b>, tu <b>cuenta de Claude</b>, el <b>demo sin IA</b> o tu propia <b>API key</b>.</p>
        </form>
        <ul className="access-perks">
          <li><${Icon} name="check" size=${16} stroke=${3} /> Gratis y sin instalar nada</li>
          <li><${Icon} name="check" size=${16} stroke=${3} /> Funciona en el ordenador y en el móvil</li>
          <li><${Icon} name="check" size=${16} stroke=${3} /> Tus sesiones quedan guardadas como chats</li>
        </ul>
      </div>
    </aside>

    <div className=${"lg:col-start-1 lg:row-start-2 flex flex-col gap-12 pt-10 pb-12 lg:pt-2 " + pad}>
      <section className="flex flex-col gap-4" aria-labelledby="feat-title">
        <div><div className="eyebrow">Funciones</div><h2 id="feat-title" className="text-2xl sm:text-[1.9rem] font-extrabold">Todo lo que puedes hacer</h2></div>
        <div className="grid sm:grid-cols-2 2xl:grid-cols-4 gap-3">
          ${FEATURES.map(([icon, tone, t, d]) => html`<article key=${t} className="feature card p-4 flex gap-3">
            <${IconTile} name=${icon} tone=${tone} />
            <div className="min-w-0"><h3 className="font-bold leading-snug">${t}</h3><p className="text-sm mt-0.5" style=${muted}>${d}</p></div>
          </article>`)}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="modes-title">
        <div><div className="eyebrow">Modos de estudio</div><h2 id="modes-title" className="text-2xl sm:text-[1.9rem] font-extrabold">Cuatro formas de estudiar</h2>
          <p className="text-sm mt-1" style=${muted}>Los eliges en la siguiente pantalla, después de acceder, y puedes cambiar de modo cuando quieras.</p></div>
        <div className="grid sm:grid-cols-2 gap-3">
          ${STUDY_MODES.map(([icon, tone, t, rec, d], i) => html`<article key=${t} className=${"feature card p-4 flex gap-3 " + (rec ? "is-rec" : "")}>
            <${IconTile} name=${icon} tone=${tone} />
            <div className="min-w-0">
              <h3 className="font-bold leading-snug flex flex-wrap items-center gap-x-2 gap-y-1"><span className="mono text-xs opacity-60">${i + 1}</span>${t}${rec && html`<span className="pill tone-butter !text-[11px] !py-0.5">★ Recomendado</span>`}</h3>
              <p className="text-sm mt-0.5" style=${muted}>${d}</p>
            </div>
          </article>`)}
        </div>
      </section>

      <section className="jq-card jq-banner rounded-[22px] p-5 sm:p-6 relative flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="jq-title text-4xl leading-none relative" aria-hidden="true">♛</span>
        <div className="relative min-w-0">
          <h2 className="jq-title text-xl font-extrabold">Nivel Jacqueline</h2>
          <p className="jq-hint text-sm">Preguntas de máxima dificultad que cruzan varios documentos y exigen dominio absoluto de cada detalle. Si lo superas, ganas la insignia de Maestro.</p>
        </div>
      </section>

      <p className="text-xs" style=${muted}>StudyMaster AI · hecho para estudiar mejor con tus propios apuntes.</p>
    </div>
  </div>`;
}

// Dentro de claude.ai no se pide apodo: si la cuenta de Claude está disponible se entra directamente;
// si no, se guía al visitante para iniciar sesión en Claude.
const CLAUDE_CAPS = ["sample", "user", "db"];
const PERM_TEXT = { granted: "concedido", prompt: "pendiente de tu permiso", denied: "rechazado", unavailable: "no disponible" };

function ClaudeGate({ caps, onEnter, notice }) {
  const muted = { color: "rgb(var(--muted))" };
  const connected = !!(caps.sample || caps.me);
  const who = caps.me?.name || caps.me?.email || "";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
  const perm = caps.perm || {};
  const state = (n) => perm[n] || "unavailable";
  const askable = CLAUDE_CAPS.filter((n) => state(n) === "prompt");
  const denied = CLAUDE_CAPS.filter((n) => state(n) === "denied");
  // Conectar: pedir a claude.ai el permiso para usar la cuenta del visitante (un solo diálogo) y recargar StudyMaster con él.
  const connect = async () => {
    setBusy(true); setMsg(null);
    try {
      if (caps.perms && askable.length) {
        const r = await caps.perms.request(askable);
        if (CLAUDE_CAPS.some((n) => r?.[n] === "granted")) { location.reload(); return; }
        setMsg("No se concedió el permiso. Pulsa «Conectar» de nuevo y elige «Permitir», o revisa los permisos de la página.");
      } else if (caps.perms && denied.length) {
        await caps.perms.manage().catch(() => setMsg("Abre el menú de la página en claude.ai (arriba, junto al nombre «StudyMaster AI») → Permisos, y activa el acceso a tu cuenta."));
        const now = await caps.perms.state().catch(() => ({}));
        if (CLAUDE_CAPS.some((n) => now?.[n] === "granted")) { location.reload(); return; }
      } else if (CLAUDE_CAPS.some((n) => state(n) === "granted")) { location.reload(); return; }
      else setMsg("claude.ai no ofrece tu cuenta a esta página. Comprueba que tienes la sesión iniciada (tu foto arriba a la derecha) y recarga con F5. Si sigue igual, tu cuenta no puede usar la IA en páginas publicadas por otra persona: usa la versión web con Gemini.");
    } finally { setBusy(false); }
  };
  // Al abrir la página con la sesión iniciada pero sin permiso concedido, se pide una vez automáticamente.
  useEffect(() => {
    if (!caps.ready || connected || !caps.perms || !askable.length || ss.get("smai:claude-asked")) return;
    ss.set("smai:claude-asked", "1");
    connect();
  }, [caps.ready]);
  return html`<div className="landing landing-access grid place-items-center px-4 py-10">
    <div className="w-full max-w-[480px] flex flex-col gap-5">
      <div className="flex justify-center"><span className="rounded-xl px-3 py-2" style=${{ background: "rgb(var(--surface))", color: "rgb(var(--ink))" }}><${Brand} /></span></div>
      <section className="access-card flex flex-col gap-4" aria-live="polite">
        ${!caps.ready ? html`<div className="flex flex-col items-center text-center gap-3 py-6">
            <span className="flex items-center gap-3 font-bold text-lg"><${Spinner} /> Conectando con tu cuenta de Claude…</span>
            <p className="text-sm" style=${muted}>Un momento: comprobamos tu sesión de claude.ai.</p>
          </div>`
        : connected ? html`<div>
              <div className="eyebrow">Cuenta de Claude</div>
              <h1 className="text-[1.6rem] leading-tight font-extrabold mt-1">Sesión de Claude conectada</h1>
            </div>
            <p className="flex items-center gap-3 rounded-xl p-3 tone-mint">
              ${caps.me?.avatarUrl ? html`<img src=${caps.me.avatarUrl} alt="" className="w-9 h-9 rounded-full" />` : html`<${IconTile} name="user" tone="mint" size=${16} className="!w-9 !h-9" />`}
              <span className="min-w-0"><b>✓ Conectado${who ? " como " + who : ""}</b><span className="block text-sm">La IA usará tu propia cuenta de Claude, sin API key.</span></span>
            </p>
            <button className="btn btn-primary w-full !py-4 !text-lg" onClick=${onEnter}>Entrar a estudiar <${Icon} name="arrow" /></button>`
        : html`<div>
              <div className="eyebrow">Cuenta de Claude</div>
              <h1 className="text-[1.6rem] leading-tight font-extrabold mt-1">Conecta tu cuenta de Claude</h1>
              <p className="text-sm mt-1" style=${muted}>StudyMaster usa la IA de tu propia cuenta de Claude (sin API key) y guarda tu historial en tu cuenta.</p>
            </div>
            ${notice && html`<p className="rounded-xl p-3 text-sm tone-peach">${notice}</p>`}
            <button className="btn btn-primary w-full !py-4 !text-lg" disabled=${busy} onClick=${connect}>
              ${busy ? html`<${Spinner} /> Conectando…` : html`<${Icon} name="user" /> Conectar mi cuenta de Claude`}
            </button>
            <p className="text-sm" style=${muted}>Si claude.ai te pregunta si StudyMaster puede usar tu cuenta, elige <b>Permitir</b>. ¿Aún no has iniciado sesión? Usa <b>«Iniciar sesión»</b> arriba a la derecha de claude.ai y vuelve a pulsar «Conectar».</p>
            ${msg && html`<p className="rounded-xl p-3 text-sm tone-butter" role="alert">${msg}</p>`}
            <details className="text-xs rounded-xl p-2.5" style=${{ background: "rgb(var(--surface-2))" }}>
              <summary className="font-bold cursor-pointer">Estado de la conexión</summary>
              <ul className="mt-1.5 flex flex-col gap-0.5" style=${muted}>
                <li>IA de Claude: <b>${PERM_TEXT[state("sample")]}</b></li>
                <li>Tu identidad: <b>${PERM_TEXT[state("user")]}</b></li>
                <li>Historial en la nube: <b>${PERM_TEXT[state("db")]}</b></li>
                ${!caps.perms && html`<li>El visor de claude.ai no respondió a la página.</li>`}
              </ul>
            </details>
            <div className="border-t pt-3 flex flex-col gap-2 text-sm" style=${{ ...muted, borderColor: "rgb(var(--line-soft))" }}>
              <button className="font-bold underline self-start text-left" style=${{ color: "rgb(var(--accent))" }} onClick=${onEnter}>Entrar sin conectar Claude (modo demo, sin IA)</button>
              <span>¿Prefieres Gemini? <a className="font-bold underline" style=${{ color: "rgb(var(--accent))" }} href=${LINKS.web} target="_blank" rel="noopener">Abre la versión web ↗</a></span>
            </div>`}
      </section>
    </div>
  </div>`;
}

// ================================================================ barra lateral (historial)
function Sidebar({ auth, caps, storeKind, engineLabel, sessions, currentId, busy, onSelect, onNew, onDelete, theme, onTheme, onLogout, open, onClose }) {
  const [confirmId, setConfirmId] = useState(null);
  const [q, setQ] = useState("");
  const list = sessions.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()));
  const groups = [];
  for (const s of list) { const g = dayGroup(s.updatedAt); let last = groups[groups.length - 1]; if (!last || last.name !== g) groups.push(last = { name: g, items: [] }); last.items.push(s); }
  const themeIcon = theme === "dark" ? "moon" : theme === "light" ? "sun" : "auto";
  const themeLabel = theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema";
  return html`<aside className=${"sidebar card flex flex-col w-[290px] shrink-0 overflow-hidden z-40 " + (open ? "fixed left-4 shadow-2xl" : "hidden lg:flex lg:sticky")}>
    <div className="flex items-center justify-between p-4 pb-3">
      <${Brand} small />
      <button className="lg:hidden p-1 rounded-md" onClick=${onClose} aria-label="Cerrar historial"><${Icon} name="x" /></button>
    </div>
    <div className="px-4 flex flex-col gap-2">
      <button className="btn btn-primary w-full" onClick=${onNew} disabled=${busy}><${Icon} name="plus" /> Nueva sesión de estudio</button>
      <input className="field !py-2 text-sm" placeholder="Buscar en el historial" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar sesiones" />
    </div>
    <nav className="flex-1 overflow-y-auto scroll-thin px-2 py-3" aria-label="Historial de sesiones">
      ${!sessions.length && html`<div className="m-2 rounded-xl p-4 text-sm tone-sky">Tus sesiones aparecerán aquí, como un historial de chats. Empieza subiendo material.</div>`}
      ${groups.map((g) => html`<div key=${g.name} className="mb-3">
        <div className="eyebrow px-2 mb-1">${g.name}</div>
        ${g.items.map((s) => html`<div key=${s.id} className=${"group side-session rounded-xl " + (s.id === currentId ? "tone-lav is-current" : "")}>
          ${confirmId === s.id ? html`<div className="flex items-center gap-2 p-2 text-sm">
              <span className="flex-1 font-bold">¿Eliminar?</span>
              <button className="btn !px-2 !py-1 text-xs" style=${{ background: "rgb(var(--bad))", color: "#fff" }} onClick=${() => { setConfirmId(null); onDelete(s.id); }}>Eliminar</button>
              <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick=${() => setConfirmId(null)}>No</button>
            </div>`
          : html`<button className="w-full text-left px-3 py-2 pr-9 rounded-xl hover:bg-[rgb(var(--surface-2))] disabled:opacity-50" disabled=${busy && s.id !== currentId} onClick=${() => onSelect(s.id)}>
              <div className="font-bold text-[14px] truncate">${s.title || "Sesión sin título"}</div>
              <div className="text-xs truncate" style=${{ color: "rgb(var(--muted))" }}>${s.fileCount} archivo(s) · ${s.quizCount} test(s)${s.bestPct >= 0 ? ` · mejor ${s.bestPct}%` : ""}</div>
            </button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-60 hover:opacity-100 focus:opacity-100" onClick=${() => setConfirmId(s.id)} aria-label=${"Eliminar " + s.title}><${Icon} name="trash" size=${15} /></button>`}
        </div>`)}
      </div>`)}
    </nav>
    <div className="p-3 border-t flex flex-col gap-2" style=${{ borderColor: "rgb(var(--line-soft))" }}>
      <div className="flex items-center gap-3 p-2 rounded-xl" style=${{ background: "rgb(var(--surface-2))" }}>
        ${auth.mode === "account" && caps.me?.avatarUrl ? html`<img src=${caps.me.avatarUrl} alt="" className="w-9 h-9 rounded-full" />` : html`<span className="w-9 h-9 rounded-full grid place-items-center tone-mint"><${Icon} name="user" /></span>`}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">${auth.mode === "account" ? caps.me?.name || caps.me?.email || "Mi cuenta" : auth.nick || "Invitado"}</div>
          <div className="text-xs truncate" style=${{ color: "rgb(var(--muted))" }}>${storeKind === "account" ? "Cuenta de Claude · historial en la nube" : auth.mode === "account" ? "Cuenta de Claude · historial local" : "Invitado · historial local"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs px-1">
        <span className="pill tone-lav max-w-full truncate">Modo: ${engineLabel}</span>
        <a className="font-bold underline shrink-0" style=${{ color: "rgb(var(--accent))" }} href=${IN_CLAUDE ? LINKS.web : LINKS.claudeApp} target="_blank" rel="noopener">${IN_CLAUDE ? "Versión web ↗" : "Abrir en Claude ↗"}</a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost !py-2 text-sm" onClick=${onTheme} aria-label=${"Tema: " + themeLabel}><${Icon} name=${themeIcon} size=${16} /> ${themeLabel}</button>
        <button className="btn btn-ghost !py-2 text-sm" onClick=${onLogout}><${Icon} name="logout" size=${16} /> Salir</button>
      </div>
    </div>
  </aside>`;
}

// ================================================================ cabecera con pasos
const STEPS = [["material", "Material"], ["config", "Configurar"], ["quiz", "Test"], ["results", "Resultados"]];
function Header({ session, step, enabled, onStep, onRename, onMenu, modeLabel, modeKind }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(session.title);
  useEffect(() => setVal(session.title), [session.title]);
  const save = () => { setEditing(false); if (val.trim() && val.trim() !== session.title) onRename(val.trim()); };
  return html`<header className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <button className="lg:hidden btn btn-ghost !p-2" onClick=${onMenu} aria-label="Abrir historial"><${Icon} name="menu" /></button>
      ${editing ? html`<input className="field !text-xl !font-bold max-w-xl" autoFocus value=${val} onInput=${(e) => setVal(e.target.value)} onBlur=${save} onKeyDown=${(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(session.title); setEditing(false); } }} aria-label="Nombre de la sesión" />`
      : html`<div className="min-w-0"><div className="eyebrow">Sesión de estudio</div><h1 className="text-[1.6rem] md:text-[2rem] font-extrabold leading-tight truncate">${session.title}</h1></div>
        <button className="p-1.5 rounded-md opacity-60 hover:opacity-100" onClick=${() => setEditing(true)} aria-label="Renombrar sesión"><${Icon} name="pencil" size=${16} /></button>`}
    </div>
    <div className="flex flex-wrap items-center gap-2">
    <ol className="flex flex-wrap gap-2" aria-label="Pasos">
      ${STEPS.map(([key, label], i) => {
        const active = step === key, ok = enabled[key];
        return html`<li key=${key}><button disabled=${!ok} onClick=${() => onStep(key)} aria-current=${active ? "step" : undefined}
          className=${"step-tab " + (active ? "tone-butter" : "")}>
          <span className="step-num">${i + 1}</span>${label}</button></li>`;
      })}
    </ol>
    <span className=${"pill border-2 ml-auto tone-" + ({ gemini: "sky", claude: "lav", api: "peach", demo: "butter" }[modeKind] || "butter")} style=${{ borderColor: "rgb(var(--line))" }} title="Modo activo" aria-label=${"Modo activo: " + modeLabel}>
      <span className="w-2 h-2 rounded-full" style=${{ background: modeKind === "demo" ? "rgb(var(--muted))" : "rgb(var(--ok))" }}></span>${modeLabel}
    </span>
    </div>
  </header>`;
}

// ================================================================ paso 1: material
async function filesFromDrop(e) {
  const items = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!items.length) return [...e.dataTransfer.files];
  const out = [];
  const walk = async (entry) => {
    if (entry.isFile) out.push(await new Promise((res, rej) => entry.file(res, rej)));
    else if (entry.isDirectory) {
      const reader = entry.createReader(); let batch;
      do { batch = await new Promise((res, rej) => reader.readEntries(res, rej)); for (const c of batch) await walk(c); } while (batch.length);
    }
  };
  for (const it of items) await walk(it);
  return out.filter((f) => !f.name.startsWith("."));
}

function ModeCard({ id, active, available, num, title, desc, tags, onPick, children }) {
  const pick = () => available && onPick(id);
  return html`<div role="radio" aria-checked=${active} aria-disabled=${!available} tabIndex=${available ? 0 : -1}
    className=${"select-card radio " + (active ? "is-on " : "") + (available ? "" : "is-locked-soft")} style=${{ cursor: available ? "pointer" : "default" }}
    onClick=${pick} onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}>
    <span className="tick">${active && html`<${Icon} name="check" size=${12} stroke=${3} />`}</span>
    <span className="flex items-center gap-2"><span className="mono text-xs opacity-60">${num}</span><span className="font-bold" style=${{ fontFamily: "var(--font-display)" }}>${title}</span></span>
    <span className="text-sm" style=${{ color: "rgb(var(--muted))" }}>${desc}</span>
    ${tags?.length > 0 && html`<span className="flex flex-wrap gap-1 mt-1">${tags.map((t) => html`<span key=${t} className="chip !text-[11px]" style=${{ color: "rgb(var(--muted))" }}>${t}</span>`)}</span>`}
    ${children}
  </div>`;
}

function ApiPanel({ api, setApi }) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const P = PROVIDERS[api.provider];
  const m = api.models?.[api.provider] || {};
  const list = m.list || [];
  const setModels = (patch) => setApi((a) => ({ ...a, models: { ...a.models, [a.provider]: { ...(a.models?.[a.provider] || {}), ...patch } } }));
  const test = async () => {
    setTesting(true); setStatus(null);
    try {
      const models = await listModels(api.provider, api.key.trim());
      if (!models.length) throw { message: "La cuenta no tiene modelos de texto disponibles." };
      const pick = pickModels(api.provider, models);
      setModels({ list: models, text: m.text && models.some((x) => x.id === m.text) ? m.text : pick.text, vision: m.vision && models.some((x) => x.id === m.vision) ? m.vision : pick.vision || "" });
      setStatus({ ok: true, text: `Conectado · ${models.length} modelo(s) disponibles` });
    } catch (e) { setStatus({ ok: false, text: e?.message || aiErrorText(e) }); }
    finally { setTesting(false); }
  };
  return html`<div className="flex flex-col gap-3 mt-2 pt-3 border-t" style=${{ borderColor: "rgb(var(--line-soft))", cursor: "default" }} onClick=${(e) => e.stopPropagation()} onKeyDown=${(e) => e.stopPropagation()}>
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Proveedor">
      ${PROVIDER_KEYS.map((p) => html`<button key=${p} role="radio" aria-checked=${api.provider === p}
        className=${"rounded-lg px-2 py-2 text-sm font-bold border-2 " + (api.provider === p ? "tone-" + PROVIDERS[p].tone : "")}
        style=${{ borderColor: api.provider === p ? "rgb(var(--line))" : "rgb(var(--line-soft))", background: api.provider === p ? undefined : "rgb(var(--surface))" }}
        onClick=${() => { setStatus(null); setApi((a) => ({ ...a, provider: p, key: apiSettings.keyFor(p, a.remember) })); }}>${PROVIDERS[p].short}</button>`)}
    </div>
    <p className="text-xs" style=${{ color: "rgb(var(--muted))" }}>${P.label}: ${P.note} <a className="underline font-bold" style=${{ color: "rgb(var(--accent))" }} href=${P.keyUrl} target="_blank" rel="noopener">Obtener una API key ↗</a></p>
    <label htmlFor="apikey" className="text-sm font-bold">API key de ${P.short}</label>
    <div className="flex gap-2">
      <input id="apikey" className="field mono !text-sm" type=${show ? "text" : "password"} autoComplete="off" spellCheck="false" placeholder=${P.keyHint}
        value=${api.key} onInput=${(e) => { setStatus(null); setApi((a) => ({ ...a, key: e.target.value })); }} />
      <button className="btn btn-ghost !px-3" onClick=${() => setShow((s) => !s)} aria-label=${show ? "Ocultar key" : "Mostrar key"}>${show ? "Ocultar" : "Ver"}</button>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked=${api.remember} onChange=${(e) => setApi((a) => ({ ...a, remember: e.target.checked }))} /> Recordar la key en este navegador</label>
    <button className="btn btn-primary" disabled=${!api.key.trim() || testing} onClick=${test}>${testing ? html`<${Spinner} /> Probando…` : "Probar conexión"}</button>
    ${status && html`<p className=${"rounded-lg p-2.5 text-sm font-bold " + (status.ok ? "tone-mint" : "tone-rose")} role="status">${status.ok ? "✓ " : "✗ "}${status.text}</p>`}
    ${list.length > 0 && html`<div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor="model-text">Modelo para generar y corregir</label>
      <select id="model-text" className="field !text-sm" value=${m.text || ""} onChange=${(e) => setModels({ text: e.target.value })}>${list.map((x) => html`<option key=${x.id} value=${x.id}>${x.id}</option>`)}</select>
      <label className="text-sm font-bold" htmlFor="model-vision">Modelo para leer imágenes y manuscritos</label>
      <select id="model-vision" className="field !text-sm" value=${m.vision || ""} onChange=${(e) => setModels({ vision: e.target.value })}>
        <option value="">Ninguno: usar OCR local (Tesseract)</option>
        ${list.filter((x) => x.vision).map((x) => html`<option key=${x.id} value=${x.id}>${x.id}</option>`)}
      </select>
    </div>`}
    <p className="text-xs" style=${{ color: "rgb(var(--muted))" }}>Tu key se guarda solo en este navegador y las solicitudes van directo de tu navegador a ${P.short}; StudyMaster no tiene servidor.</p>
  </div>`;
}

// Paso numerado del panel guiado (fuera del panel para que el campo de la key no se recree al escribir).
const GuideStep = ({ n, done, children }) => html`<li className="flex gap-3">
    <span className=${"mono font-bold w-7 h-7 shrink-0 grid place-items-center rounded-md border-2 " + (done ? "tone-mint" : "")} style=${{ borderColor: "rgb(var(--line))", background: done ? undefined : "rgb(var(--surface))" }}>${done ? "✓" : n}</span>
    <div className="min-w-0 flex-1 flex flex-col gap-2 pt-0.5">${children}</div>
</li>`;

function GeminiPanel({ gem, setGem }) {
  const [draft, setDraft] = useState(gem.key);
  const [show, setShow] = useState(false);
  const [state, setState] = useState(gem.key && gem.model ? { ok: true } : null);
  const timer = useRef(null), seq = useRef(0);
  // Valida en cuanto se pega o escribe la key (con una pequeña pausa para no consultar a cada tecla).
  const validate = (key, remember) => {
    clearTimeout(timer.current);
    const k = key.trim();
    if (!k) { setState(null); return; }
    if (k.length < 20) { setState({ ok: false, text: AI_ERRORS.gemini_invalid }); return; }
    const my = ++seq.current;
    setState({ checking: true });
    timer.current = setTimeout(async () => {
      try {
        const { model, models } = await connectGemini(k);
        if (my !== seq.current) return;
        setGem({ key: k, remember, model, models });
        setState({ ok: true });
      } catch (e) {
        if (my !== seq.current) return;
        setGem({ key: "", remember, model: "", models: [] });
        setState({ ok: false, text: e?.code === "auth" ? AI_ERRORS.gemini_invalid : e?.code === "gemini_quota" ? AI_ERRORS.gemini_quota : e?.message || aiErrorText(e) });
      }
    }, 450);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  // Una key guardada antes de existir el selector se revalida para elegir el Flash más reciente y cargar la lista de modelos.
  useEffect(() => { if (gem.key && !gem.models?.length) validate(gem.key, gem.remember); }, []);
  const connected = state?.ok && gem.key;
  return html`<div className="flex flex-col gap-3 mt-2 pt-3 border-t" style=${{ borderColor: "rgb(var(--line-soft))", cursor: "default" }} onClick=${(e) => e.stopPropagation()} onKeyDown=${(e) => e.stopPropagation()}>
    ${connected
      ? html`<div className="rounded-xl p-3 tone-mint flex flex-col gap-2" role="status">
          <b>Conectado con tu cuenta de Google ✓</b>
          <label htmlFor="gemini-model" className="text-sm font-bold">Versión de Gemini para esta sesión</label>
          <select id="gemini-model" className="field !text-sm mono" value=${gem.model} onChange=${(e) => setGem({ ...gem, model: e.target.value })}>
            ${(gem.models?.length ? gem.models : [{ id: gem.model }]).map((m) => html`<option key=${m.id} value=${m.id}>${m.label || m.id}${m.id === bestGeminiFlash((gem.models || []).map((x) => x.id)) ? "  (recomendado)" : ""}</option>`)}
          </select>
          <span className="text-xs">Se eligió automáticamente el Gemini Flash más reciente de tu cuenta. Puedes cambiarlo cuando quieras. La key se guarda ${gem.remember ? "en este navegador" : "solo durante esta sesión"}.</span>
          <button className="btn btn-ghost !py-1.5 text-sm self-start" onClick=${() => { seq.current++; setGem({ key: "", remember: false, model: "", models: [] }); setDraft(""); setState(null); }}>Desconectar</button>
        </div>`
      : html`<ol className="flex flex-col gap-4">
          <${GuideStep} n="1">
            <b className="text-sm">Inicia sesión con tu cuenta de Google</b>
            <a className="btn btn-primary !py-2 text-sm self-start !whitespace-normal text-center" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Iniciar sesión en Google AI Studio ↗</a>
          <//>
          <${GuideStep} n="2">
            <b className="text-sm">Pulsa «Create API key» (es gratis) y cópiala</b>
          <//>
          <${GuideStep} n="3" done=${state?.ok}>
            <label htmlFor="gemini-key" className="text-sm font-bold">Pega tu key aquí</label>
            <div className="flex gap-2">
              <input id="gemini-key" className="field mono !text-sm" type=${show ? "text" : "password"} autoComplete="off" spellCheck="false" placeholder="AIza…"
                value=${draft} onInput=${(e) => { setDraft(e.target.value); validate(e.target.value, gem.remember); }} />
              <button className="btn btn-ghost !px-3" onClick=${() => setShow((s) => !s)} aria-label=${show ? "Ocultar key" : "Ver key"}>${show ? "Ocultar" : "Ver"}</button>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked=${gem.remember} onChange=${(e) => { setGem({ ...gem, remember: e.target.checked }); if (draft.trim()) validate(draft, e.target.checked); }} /> Recordar en este navegador</label>
            ${state?.checking && html`<p className="text-sm font-bold flex items-center gap-2" style=${{ color: "rgb(var(--accent))" }}><${Spinner} /> Comprobando tu key…</p>`}
            ${state && !state.ok && !state.checking && html`<p className="rounded-lg p-2.5 text-sm font-bold tone-rose" role="alert">✗ ${state.text}</p>`}
          <//>
        </ol>`}
    <p className="text-xs" style=${{ color: "rgb(var(--muted))" }}>Tu key queda solo en este navegador y las solicitudes van directo de tu navegador a Google. StudyMaster no tiene servidor y nunca la guarda ni la registra.</p>
  </div>`;
}

function ModePanel({ mode, onMode, claudeOk, claudeVision, claudeDiag, api, setApi, apiReady, gem, setGem, geminiReady }) {
  return html`<section className="card p-5 flex flex-col gap-3">
    <div className="section-head"><${IconTile} name="spark" tone="lav" size=${18} className="!w-9 !h-9" /><div><div className="eyebrow">Modo de uso</div><h3 className="text-lg font-bold leading-tight">¿Quién lee y pregunta?</h3></div></div>
    <${ModeCard} id="gemini" num="1" active=${mode === "gemini"} available=${!IN_CLAUDE} onPick=${onMode}
      title=${html`With Gemini <span className="pill tone-butter !text-[11px] ml-1 align-middle">★ Recomendado</span>`}
      desc=${IN_CLAUDE ? "Disponible en la versión web: este visor de Claude bloquea conexiones a otros servicios." : "Entra con tu cuenta de Google y usa Gemini gratis: lee imágenes y letra a mano, redacta preguntas y valida tus respuestas."}
      tags=${IN_CLAUDE ? [] : ["cuenta de Google", "gratis", "OCR + manuscritos"]}>
      ${IN_CLAUDE && html`<a className="btn btn-ghost !py-2 text-sm mt-2 self-start" href=${LINKS.web} target="_blank" rel="noopener" onClick=${(e) => e.stopPropagation()}>Abrir versión web ↗</a>`}
      ${!IN_CLAUDE && mode === "gemini" && html`<${GeminiPanel} gem=${gem} setGem=${setGem} />`}
      ${!IN_CLAUDE && mode === "gemini" && !geminiReady && html`<p className="text-xs font-bold mt-1 text-peach">Mientras conectas tu cuenta se usa el modo demo.</p>`}
    <//>
    <${ModeCard} id="claude" num="2" active=${mode === "claude"} available=${IN_CLAUDE ? claudeOk : true} onPick=${IN_CLAUDE ? onMode : () => window.open(LINKS.claudeApp, "_blank", "noopener")}
      title=${html`Cuenta de Claude <span className="pill tone-butter !text-[11px] ml-1 align-middle">★ Recomendado</span>`}
      desc=${IN_CLAUDE ? (claudeOk ? "Usa tu propia cuenta de Claude, sin API key: lee imágenes y letra a mano, redacta preguntas a medida y valida tus respuestas." : "claude.ai no ofrece la IA de tu cuenta a esta página. Pasa si no has iniciado sesión o si la abres con una cuenta distinta de la que publicó la página. Mientras tanto se usa el modo demo.") : "Inicia sesión con tu correo en Claude y StudyMaster usará tu propia cuenta, sin API key: lee imágenes y letra a mano y redacta preguntas a medida."}
      tags=${IN_CLAUDE ? (claudeVision ? ["OCR + manuscritos", "preguntas IA", "validación IA"] : ["preguntas IA", "validación IA"]) : []}>
      ${IN_CLAUDE && !claudeOk && claudeDiag && html`<span className="text-xs mt-1 rounded-lg px-2 py-1.5" style=${{ background: "rgb(var(--surface-2))", color: "rgb(var(--muted))" }}>Estado: ${claudeDiag}</span>`}
      ${IN_CLAUDE && !claudeOk && html`<button className="btn btn-primary !py-2 text-sm mt-2 self-start" onClick=${async (e) => {
        e.stopPropagation();
        // Pide a claude.ai el permiso para usar la cuenta y recarga StudyMaster con él.
        const p = await window.claude?.use("permissions").catch(() => null);
        if (p) { const st = await p.state().catch(() => ({})); const ask = CLAUDE_CAPS.filter((n) => st?.[n] === "prompt"); if (ask.length) await p.request(ask).catch(() => {}); }
        location.reload();
      }}><${Icon} name="user" size=${16} /> Conectar mi cuenta de Claude</button>`}
      ${!IN_CLAUDE && html`<a className="btn btn-primary !py-2 text-sm mt-2 self-start !whitespace-normal" href=${LINKS.claudeApp} target="_blank" rel="noopener" onClick=${(e) => e.stopPropagation()}><${Icon} name="user" size=${16} /> Abrir en Claude ↗</a>
        <span className="text-xs mt-1" style=${{ color: "rgb(var(--muted))" }}>StudyMaster se abre como artefacto en Claude (claude.ai en el navegador o la app de Claude) y entra directo a la página de estudio con la IA de tu cuenta.</span>`}
    <//>
    <${ModeCard} id="demo" num="3" active=${mode === "demo"} available=${true} onPick=${onMode}
      title="Demo local" desc="Sin IA: extracción con PDF.js y Mammoth, OCR con Tesseract y preguntas por reglas, todo en tu navegador."
      tags=${["sin cuenta", "privado", "texto impreso"]}>
      ${mode === "demo" && html`<div className="mt-2 rounded-xl p-3 tone-butter text-sm flex flex-col gap-2" role="note" onClick=${(e) => e.stopPropagation()} style=${{ cursor: "default" }}>
        <b>Recomendación sobre el modo demo</b>
        <span>Este modo es más simple: no usa inteligencia artificial y crea las preguntas con reglas a partir de las oraciones de tus documentos. Funciona mejor con <b>Word, PDF o archivos de texto</b> con párrafos bien redactados; con fotos, esquemas o apuntes a mano obtendrá poco.</span>
        <span>Para mejores resultados y un análisis más completo, inicia sesión con <b>Claude</b> o conecta <b>Gemini</b>. Si lo prefieres, puedes seguir en este modo.</span>
        <span className="flex flex-wrap gap-2">
          ${!IN_CLAUDE && html`<button className="btn btn-primary !py-1.5 text-sm" onClick=${() => onMode("gemini")}>Usar With Gemini</button>`}
          ${IN_CLAUDE ? claudeOk && html`<button className="btn btn-primary !py-1.5 text-sm" onClick=${() => onMode("claude")}>Usar mi cuenta de Claude</button>`
            : html`<a className="btn btn-ghost !py-1.5 text-sm" href=${LINKS.claudeApp} target="_blank" rel="noopener">Abrir en Claude ↗</a>`}
        </span>
      </div>`}
    <//>
    <${ModeCard} id="api" num="4" active=${mode === "api"} available=${!IN_CLAUDE} onPick=${onMode}
      title="Mi API key" desc=${IN_CLAUDE ? "Disponible en la versión web: este visor de Claude bloquea conexiones a otros servicios." : "Conecta tu key de Google Gemini, Llama (vía Groq) o Grok (xAI)."}
      tags=${IN_CLAUDE ? [] : ["Gemini", "Llama", "Grok"]}>
      ${IN_CLAUDE && html`<a className="btn btn-ghost !py-2 text-sm mt-2 self-start" href=${LINKS.web} target="_blank" rel="noopener" onClick=${(e) => e.stopPropagation()}>Abrir versión web ↗</a>`}
      ${!IN_CLAUDE && mode === "api" && html`<${ApiPanel} api=${api} setApi=${setApi} />`}
      ${!IN_CLAUDE && mode === "api" && !apiReady && html`<p className="text-xs font-bold mt-1 text-peach">Escribe tu key y pulsa «Probar conexión». Mientras tanto se usa el modo demo.</p>`}
    <//>
  </section>`;
}

function MaterialStep({ session, modePanel, onFiles, onSample, onRemove, onToggle, onNext }) {
  const input = useRef(null), folder = useRef(null);
  const [over, setOver] = useState(false);
  const files = session.files;
  const excluded = new Set(session.excluded || []);
  const ready = files.filter((f) => f.status === "ready");
  const busy = files.some((f) => f.status === "queued" || f.status === "processing");
  const chars = ready.reduce((n, f) => n + (f.stats?.chars || 0), 0);
  return html`<div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
    <section className="card p-5 md:p-6 flex flex-col gap-4 min-w-0">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="section-head"><${IconTile} name="upload" tone="sky" size=${18} className="!w-9 !h-9" /><div><div className="eyebrow">Paso 1</div><h2 className="text-xl font-bold leading-tight">Sube tu material</h2></div></div>
        <button className="btn btn-ghost !py-2 text-sm" onClick=${onSample}><${Icon} name="file" size=${16} /> Probar con un ejemplo</button>
      </div>
      <div className=${"dropzone p-8 flex flex-col items-center text-center gap-2 " + (over ? "is-over" : "")}
        onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
        onDrop=${async (e) => { e.preventDefault(); setOver(false); const fs = await filesFromDrop(e); if (fs.length) onFiles(fs); }}>
        <span className="w-14 h-14 rounded-2xl grid place-items-center flat tone-sky"><${Icon} name="upload" size=${26} /></span>
        <div className="font-bold text-lg" style=${{ fontFamily: "var(--font-display)" }}>Arrastra archivos o carpetas completas</div>
        <div className="text-sm" style=${{ color: "rgb(var(--muted))" }}>Sin límite de cantidad · PDF · Word · PowerPoint · Google Docs · Canva · PNG/JPG/WEBP · fotos de apuntes</div>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <button className="btn btn-primary" onClick=${() => input.current.click()}><${Icon} name="plus" /> Elegir archivos</button>
          <button className="btn btn-ghost" onClick=${() => folder.current.click()}><${Icon} name="folder" /> Elegir carpeta</button>
        </div>
        <input ref=${input} type="file" multiple accept=${ACCEPT} hidden onChange=${(e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length) onFiles(fs); }} />
        <input ref=${folder} type="file" multiple webkitdirectory="" hidden onChange=${(e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length) onFiles(fs); }} />
      </div>

      ${files.length > 0 && html`<div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-bold"><span>${files.length} archivo(s) · ${ready.length} listo(s)</span><span className="mono" style=${{ color: "rgb(var(--muted))" }}>${chars.toLocaleString("es")} caracteres</span></div>
        <ul className="flex flex-col gap-2 max-h-[480px] overflow-y-auto scroll-thin pr-1">
          ${files.map((f) => html`<li key=${f.id} className="flex items-center gap-3 rounded-2xl p-3 border-2" style=${{ borderColor: f.status === "error" ? "rgb(var(--bad))" : "rgb(var(--line-soft))", background: "rgb(var(--surface))" }}>
            <input type="checkbox" className="w-4 h-4 accent-[rgb(var(--accent))]" disabled=${f.status !== "ready"} checked=${f.status === "ready" && !excluded.has(f.id)} onChange=${() => onToggle(f.id)} aria-label=${"Incluir " + f.name} />
            <span className=${"mono text-[11px] font-bold rounded-md px-1.5 py-1 min-w-[40px] text-center tone-" + ({ PDF: "rose", DOC: "sky", PPT: "peach", IMG: "mint", TXT: "butter" }[f.kind] || "lav")}>${f.kind}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate" title=${f.name}>${f.name}</div>
              <div className="text-xs flex flex-wrap gap-x-3" style=${{ color: "rgb(var(--muted))" }}>
                <span>${fmtSize(f.size || 0)}</span>
                ${f.status === "ready" && html`<span>${f.stats.sections} secciones</span>`}
                ${f.status === "ready" && f.stats.images > 0 && html`<span>${f.stats.images} imagen(es) analizadas</span>`}
                ${f.status === "ready" && f.stats.handwriting && html`<span className="text-butter font-bold">✍ manuscrito detectado</span>`}
                ${f.truncated && html`<span>texto recortado al guardar</span>`}
                ${(f.status === "processing" || f.status === "queued") && html`<span style=${{ color: "rgb(var(--accent))" }}>${f.progress}</span>`}
                ${f.status === "error" && html`<span style=${{ color: "rgb(var(--bad))" }}>${f.error}</span>`}
              </div>
            </div>
            <span className=${"pill " + (f.status === "ready" ? "tone-mint" : f.status === "error" ? "tone-rose" : "tone-sky")}>
              ${f.status === "processing" && html`<${Spinner} />`}${{ queued: "En cola", processing: "Analizando", ready: "Listo", error: "Error" }[f.status]}
            </span>
            <button className="p-1 rounded-md opacity-60 hover:opacity-100" onClick=${() => onRemove(f.id)} aria-label=${"Quitar " + f.name} disabled=${f.status === "processing"}><${Icon} name="x" /></button>
          </li>`)}
        </ul>
      </div>`}
    </section>

    <aside className="flex flex-col gap-4 min-w-0">
      ${modePanel}
      <button className="btn btn-primary py-3.5 text-base" disabled=${!ready.length} onClick=${onNext}>
        ${busy && html`<${Spinner} />`} Continuar a la configuración <${Icon} name="arrow" />
      </button>
      ${busy && html`<p className="text-sm text-center" style=${{ color: "rgb(var(--muted))" }}>Puedes configurar el test mientras se analizan los demás archivos.</p>`}
    </aside>
  </div>`;
}

// ================================================================ paso 2: configuración
function ConfigStep({ session, engineLabel, generating, onGenerate }) {
  const init = session.lastConfig || { modes: ["multiple_choice", "true_false"], difficulty: "medium", count: 10 };
  const [modes, setModes] = useState(init.modes);
  const [difficulty, setDifficulty] = useState(init.difficulty);
  const [count, setCount] = useState(init.count);
  const [custom, setCustom] = useState(![5, 10, 20, 30].includes(init.count));
  const full = modes.length >= MAX_MODES;
  const toggle = (m) => setModes((p) => (p.includes(m) ? p.filter((x) => x !== m) : full ? p : [...p, m]));
  const excluded = new Set(session.excluded || []);
  const docs = session.files.filter((f) => f.status === "ready" && !excluded.has(f.id));
  const jq = difficulty === "jacqueline";
  const valid = modes.length > 0 && count >= 1 && count <= 100 && docs.length > 0;
  return html`<div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
    <section className="card p-5 md:p-6 flex flex-col gap-6 min-w-0">
      <div className="section-head"><${IconTile} name="target" tone="peach" size=${18} className="!w-9 !h-9" /><div><div className="eyebrow">Paso 2</div><h2 className="text-xl font-bold leading-tight">Configura tu test</h2></div></div>

      <fieldset className="flex flex-col gap-3">
        <legend className="flex items-center gap-2 font-bold mb-3">Modalidades de preguntas
          <span className=${"chip mono " + (full ? "tone-butter" : "")} style=${full ? {} : { color: "rgb(var(--muted))" }}>${modes.length}/${MAX_MODES}</span>
        </legend>
        <div className="grid sm:grid-cols-2 gap-3">
          ${MODE_KEYS.map((m) => {
            const on = modes.includes(m), locked = !on && full;
            return html`<button key=${m} className=${"select-card " + (on ? "is-on " : "") + (locked ? "is-locked" : "")} aria-pressed=${on} aria-disabled=${locked} onClick=${() => !locked && toggle(m)} title=${locked ? "Máximo 3 modalidades combinadas" : ""}>
              <span className="tick">${on && html`<${Icon} name="check" size=${12} stroke=${3} />`}</span>
              <span className="flex items-center gap-2"><span className=${"w-2.5 h-2.5 rounded-sm tone-" + MODES[m].tone} style=${{ outline: "1.5px solid rgb(var(--line))" }}></span><span className="font-bold">${MODES[m].label}</span></span>
              <span className="text-sm" style=${{ color: "rgb(var(--muted))" }}>${locked ? "🔒 Límite de 3 modalidades alcanzado" : MODES[m].hint}</span>
            </button>`;
          })}
        </div>
        ${!modes.length && html`<p className="text-sm" style=${{ color: "rgb(var(--bad))" }}>Elige al menos una modalidad.</p>`}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-bold mb-3">Nivel de dificultad</legend>
        <div className="grid sm:grid-cols-3 gap-3">
          ${["easy", "medium", "hard"].map((d) => html`<button key=${d} className=${"select-card radio " + (difficulty === d ? "is-on" : "")} aria-pressed=${difficulty === d} onClick=${() => setDifficulty(d)}>
            <span className="tick">${difficulty === d && html`<span className="w-2 h-2 rounded-full" style=${{ background: "rgb(var(--paper))" }}></span>`}</span>
            <span className=${"pill self-start tone-" + DIFFS[d].tone}>${DIFFS[d].label}</span>
            <span className="text-sm mt-1" style=${{ color: "rgb(var(--muted))" }}>${DIFFS[d].hint}</span>
          </button>`)}
        </div>
        <button className=${"select-card radio jq-card " + (jq ? "is-on" : "")} aria-pressed=${jq} onClick=${() => setDifficulty("jacqueline")}>
          <span className="tick">${jq && html`<span className="w-2 h-2 rounded-full" style=${{ background: "rgb(var(--jq-deep))" }}></span>`}</span>
          <span className="flex flex-wrap items-center gap-2 relative z-10"><span className="jq-title text-xl font-extrabold" style=${{ fontFamily: "var(--font-display)" }}>♛ Jacqueline</span><span className="jq-badge">Nivel maestro · extremo</span></span>
          <span className="jq-hint text-sm relative z-10">Ultra-específicas, capciosas y de correlación avanzada entre documentos. Exige dominio absoluto de cada detalle del material.</span>
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-bold mb-3">Cantidad de preguntas</legend>
        <div className="flex flex-wrap items-center gap-2">
          ${[5, 10, 20, 30].map((n) => html`<button key=${n} className=${"btn !px-4 !py-2 mono " + (!custom && count === n ? "btn-primary" : "btn-ghost")} onClick=${() => { setCustom(false); setCount(n); }}>${n}</button>`)}
          <button className=${"btn !px-4 !py-2 " + (custom ? "btn-primary" : "btn-ghost")} onClick=${() => setCustom(true)}>Personalizado</button>
          ${custom && html`<input type="number" min="1" max="100" className="field !w-24 mono" value=${count} autoFocus aria-label="Número de preguntas" onInput=${(e) => setCount(clamp(parseInt(e.target.value || "0", 10) || 0, 0, 100))} />`}
        </div>
        ${custom && (count < 1 || count > 100) && html`<p className="text-sm" style=${{ color: "rgb(var(--bad))" }}>Elige entre 1 y 100 preguntas.</p>`}
      </fieldset>
    </section>

    <aside className="flex flex-col gap-4 min-w-0">
      <section className="card p-5 flex flex-col gap-3">
        <div className="eyebrow">Resumen</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt style=${{ color: "rgb(var(--muted))" }}>Documentos</dt><dd className="font-bold">${docs.length}</dd>
          <dt style=${{ color: "rgb(var(--muted))" }}>Modalidades</dt><dd className="flex flex-wrap gap-1">${modes.map((m) => html`<span key=${m} className=${"chip tone-" + MODES[m].tone}>${MODES[m].label}</span>`)}</dd>
          <dt style=${{ color: "rgb(var(--muted))" }}>Dificultad</dt><dd>${jq ? html`<span className="jq-badge">♛ Jacqueline</span>` : html`<span className=${"pill tone-" + DIFFS[difficulty].tone}>${DIFFS[difficulty].label}</span>`}</dd>
          <dt style=${{ color: "rgb(var(--muted))" }}>Preguntas</dt><dd className="font-bold mono">${count}</dd>
          <dt style=${{ color: "rgb(var(--muted))" }}>Motor</dt><dd className="font-bold">${engineLabel}</dd>
        </dl>
      </section>
      <button className=${"btn py-3.5 text-base " + (jq ? "jq-button" : "btn-primary")} disabled=${!valid || !!generating} onClick=${() => onGenerate({ modes, difficulty, count })}>
        ${generating ? html`<${Spinner} /> Generando…` : jq ? html`<${Icon} name="crown" /> Enfrentar el Nivel Jacqueline` : html`<${Icon} name="spark" /> Generar test`}
      </button>
      ${generating && html`<p className="text-sm text-center" style=${{ color: "rgb(var(--muted))" }}>${generating}</p>`}
      ${!docs.length && html`<p className="text-sm text-center" style=${{ color: "rgb(var(--bad))" }}>Necesitas al menos un documento listo y marcado.</p>`}
    </aside>
  </div>`;
}

// ================================================================ paso 3: test
function fillSuggestion(q, values) {
  const hits = q.answers.map((variants, i) => variants.some((v) => closeEnough(values[i] || "", v)));
  return { hits, all: hits.every(Boolean), some: hits.some(Boolean) };
}
function openSuggestion(q, text) {
  const n = normalize(text);
  const hits = (q.keyPoints || []).filter((k) => { const nk = normalize(k); return nk && (n.includes(nk) || nk.split(" ").filter((w) => w.length > 3).some((w) => n.includes(w))); });
  return { hits, total: (q.keyPoints || []).length };
}

function QuizStep({ quiz, aiOk, onChoice, onSubmitText, onSelfEval, onAIValidate, onNext, onExit }) {
  const q = quiz.questions[quiz.current];
  const a = quiz.answers[q.id];
  const [values, setValues] = useState([]);
  const [text, setText] = useState("");
  const [validating, setValidating] = useState(false);
  const firstRef = useRef(null);
  useEffect(() => { setValues(q.type === "fill_blank" ? Array(q.answers.length).fill("") : []); setText(""); setValidating(false); setTimeout(() => firstRef.current?.focus(), 0); }, [q.id]);
  const resolved = a && a.correct !== null && a.correct !== undefined;
  const isLast = quiz.current === quiz.questions.length - 1;
  const correctCount = Object.values(quiz.answers).filter((x) => x.correct === true).length;
  const answeredCount = Object.values(quiz.answers).filter((x) => x.correct === true || x.correct === false).length;
  const mode = MODES[q.type];

  const submitText = () => {
    if (q.type === "fill_blank") { if (values.some((v) => v.trim())) onSubmitText(q.id, values); }
    else if (text.trim()) onSubmitText(q.id, text);
  };
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Enter" && resolved) { e.preventDefault(); onNext(); return; }
      if (typing || a) return;
      if (q.type === "multiple_choice") {
        const n = /^[1-8]$/.test(e.key) ? +e.key - 1 : LETTERS.indexOf(e.key.toUpperCase());
        if (n >= 0 && n < q.options.length) onChoice(q.id, n);
      } else if (q.type === "true_false") {
        if (e.key.toLowerCase() === "v") onChoice(q.id, true);
        if (e.key.toLowerCase() === "f") onChoice(q.id, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const fillParts = q.type === "fill_blank" ? q.prompt.split(BLANK) : null;
  const sugg = a?.submitted ? (q.type === "fill_blank" ? fillSuggestion(q, a.given) : openSuggestion(q, a.given)) : null;

  return html`<div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <button className="btn btn-ghost !py-2 text-sm" onClick=${onExit}>← Configuración</button>
      <div className="flex items-center gap-3 text-sm">
        ${quiz.config.difficulty === "jacqueline" ? html`<span className="jq-badge">♛ Jacqueline</span>` : html`<span className=${"pill tone-" + DIFFS[quiz.config.difficulty].tone}>${DIFFS[quiz.config.difficulty].label}</span>`}
        <span className="mono font-bold">${quiz.current + 1}/${quiz.questions.length}</span>
        <span className="mono pill tone-mint">✓ ${correctCount}/${answeredCount}</span>
      </div>
    </div>
    <div className="h-2.5 rounded-full overflow-hidden border-2" style=${{ borderColor: "rgb(var(--line))", background: "rgb(var(--surface))" }}>
      <div className="progress-fill h-full transition-all" style=${{ width: `${((quiz.current + (resolved ? 1 : 0)) / quiz.questions.length) * 100}%`, background: "rgb(var(--accent))" }}></div>
    </div>

    <article className="q-card card flat !rounded-3xl p-5 md:p-7 flex flex-col gap-5 pop" key=${q.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className=${"chip tone-" + mode.tone}>${mode.label}</span>
        <span className="text-xs" style=${{ color: "rgb(var(--muted))" }}>${q.source.doc}${q.source.loc ? " · " + q.source.loc : ""}</span>
        <span className="ml-auto text-xs eyebrow">${q.type === "multiple_choice" || q.type === "true_false" ? "Corrección inmediata" : "Respuesta escrita"}</span>
      </div>

      ${q.topic && html`<div className="flex items-center gap-2 -mb-2"><span className="eyebrow">Temática</span><span className="font-bold text-[15px] truncate" style=${{ fontFamily: "var(--font-display)" }}>${q.topic}</span></div>`}
      ${q.type === "fill_blank"
        ? html`<p className="text-lg md:text-xl leading-[2.2] font-medium whitespace-pre-line">${fillParts.map((part, i) => html`<span key=${i}>${part}${i < fillParts.length - 1 && html`<input ref=${i === 0 ? firstRef : null} className="blank-input mx-1" value=${values[i] || ""} disabled=${!!a} placeholder=${"hueco " + (i + 1)} aria-label=${"Hueco " + (i + 1)}
            onInput=${(e) => { const v = [...values]; v[i] = e.target.value; setValues(v); }} onKeyDown=${(e) => { if (e.key === "Enter" && !a) { e.preventDefault(); submitText(); } }} />`}</span>`)}</p>`
        : html`<p className="text-lg md:text-xl leading-relaxed font-medium whitespace-pre-line">${q.prompt}</p>`}

      ${q.type === "multiple_choice" && html`<div className="flex flex-col gap-2.5">
        ${q.options.map((opt, i) => {
          const st = a ? (i === q.answerIndex ? "is-correct" : i === a.given ? "is-wrong" : "") : "";
          return html`<button key=${i} className=${"option " + st} disabled=${!!a} onClick=${() => onChoice(q.id, i)}><span className="key">${LETTERS[i]}</span><span>${opt}</span></button>`;
        })}
      </div>`}

      ${q.type === "true_false" && html`<div className="grid grid-cols-2 gap-3">
        ${[true, false].map((v) => {
          const st = a ? (v === q.answerBool ? "is-correct" : v === a.given ? "is-wrong" : "") : "";
          return html`<button key=${String(v)} className=${"option justify-center !py-5 font-bold text-lg " + st} disabled=${!!a} onClick=${() => onChoice(q.id, v)}><span className="key">${v ? "V" : "F"}</span>${v ? "Verdadero" : "Falso"}</button>`;
        })}
      </div>`}

      ${q.type === "open" && html`<textarea ref=${firstRef} className="field min-h-[150px] leading-relaxed" placeholder="Redacta tu respuesta con tus palabras…" value=${a ? a.given : text} disabled=${!!a} onInput=${(e) => setText(e.target.value)} aria-label="Tu respuesta"></textarea>`}

      ${(q.type === "fill_blank" || q.type === "open") && !a && html`<div className="flex justify-end">
        <button className="btn btn-primary" disabled=${q.type === "open" ? !text.trim() : !values.some((v) => v.trim())} onClick=${submitText}>Enviar respuesta <${Icon} name="arrow" /></button>
      </div>`}

      ${a && (q.type === "multiple_choice" || q.type === "true_false") && html`<div className=${"rounded-2xl p-4 pop " + (a.correct ? "verdict-ok" : "verdict-bad")} role="status">
        <div className="font-extrabold text-lg" style=${{ color: a.correct ? "rgb(var(--ok))" : "rgb(var(--bad))", fontFamily: "var(--font-display)" }}>${a.correct ? "✓ ¡Correcto!" : "✗ Incorrecto"}</div>
        ${!a.correct && html`<p className="mt-1"><b>Respuesta correcta:</b> ${q.type === "true_false" ? (q.answerBool ? "Verdadero" : "Falso") : `${LETTERS[q.answerIndex]}) ${q.options[q.answerIndex]}`}</p>`}
        <p className="mt-1 text-[15px] whitespace-pre-line" style=${{ color: "rgb(var(--muted))" }}>${q.explanation}</p>
      </div>`}

      ${a?.submitted && html`<div className="official rounded-2xl p-4 flex flex-col gap-3 pop">
        <div className="eyebrow !text-[rgb(var(--ink))]">Respuesta oficial del documento</div>
        ${q.type === "fill_blank"
          ? html`<ul className="flex flex-col gap-1">${q.answers.map((v, i) => html`<li key=${i}><b>Hueco ${i + 1}:</b> ${v[0]}${v.length > 1 ? html`<span className="text-sm opacity-75"> (también: ${v.slice(1).join(", ")})</span>` : ""} <span className="text-sm opacity-75">· tú: «${a.given[i] || "—"}» ${sugg.hits[i] ? "✓" : ""}</span></li>`)}</ul>`
          : html`<p className="leading-relaxed whitespace-pre-line">${q.modelAnswer}</p>
            ${q.keyPoints?.length > 0 && html`<div className="flex flex-wrap gap-1.5">${q.keyPoints.map((k) => html`<span key=${k} className=${"chip " + (sugg.hits.includes(k) ? "tone-mint" : "")}>${sugg.hits.includes(k) ? "✓ " : ""}${k}</span>`)}</div>`}`}
        ${q.explanation && html`<p className="text-sm opacity-80 whitespace-pre-line">${q.explanation}</p>`}
        <p className="text-sm font-bold">${q.type === "fill_blank" ? (sugg.all ? "Tu respuesta coincide con la oficial." : sugg.some ? "Coincide en parte con la oficial." : "No coincide literalmente: compara el significado.") : sugg.total ? `Mencionas ${sugg.hits.length} de ${sugg.total} ideas clave.` : ""}</p>
        ${a.feedback && html`<p className="rounded-xl p-3 text-sm tone-lav"><b>Validación IA:</b> ${a.feedback}</p>`}
        ${!resolved ? html`<div className="flex flex-wrap gap-2">
            <button className="btn flex-1 border-2" style=${{ borderColor: "rgb(var(--ok))", background: "rgb(var(--surface))", color: "rgb(var(--ok))" }} onClick=${() => onSelfEval(q.id, true)}>✅ Respondí bien</button>
            <button className="btn flex-1 border-2" style=${{ borderColor: "rgb(var(--bad))", background: "rgb(var(--surface))", color: "rgb(var(--bad))" }} onClick=${() => onSelfEval(q.id, false)}>❌ Me equivoqué</button>
            ${aiOk && html`<button className="btn btn-ghost flex-1" disabled=${validating} onClick=${async () => { setValidating(true); await onAIValidate(q.id); setValidating(false); }}>${validating ? html`<${Spinner} /> Validando…` : html`<${Icon} name="spark" size=${16} /> Validar con IA`}</button>`}
          </div>`
        : html`<div className=${"rounded-xl p-3 font-bold " + (a.correct ? "verdict-ok" : "verdict-bad")}>${a.correct ? "✓ Registrada como correcta" : "✗ Registrada como incorrecta"} <span className="font-normal text-sm opacity-75">(${a.method === "ai" ? "validación IA" : "autoevaluación"})</span></div>`}
      </div>`}

      ${resolved && html`<div className="flex justify-end"><button className="btn btn-primary" onClick=${onNext}>${isLast ? "Ver resultados" : "Siguiente pregunta"} <${Icon} name="arrow" /></button></div>`}
    </article>
    <p className="text-xs text-center" style=${{ color: "rgb(var(--muted))" }}>Atajos: 1–5 o A–E para elegir · V / F · Enter para avanzar</p>
  </div>`;
}

// ================================================================ paso 4: resultados
function userAnswerText(q, a) {
  if (!a) return "Sin responder";
  if (q.type === "multiple_choice") return `${LETTERS[a.given]}) ${q.options[a.given]}`;
  if (q.type === "true_false") return a.given ? "Verdadero" : "Falso";
  if (q.type === "fill_blank") return a.given.map((v) => v || "—").join(" · ");
  return a.given;
}
function correctAnswerText(q) {
  if (q.type === "multiple_choice") return `${LETTERS[q.answerIndex]}) ${q.options[q.answerIndex]}`;
  if (q.type === "true_false") return q.answerBool ? "Verdadero" : "Falso";
  if (q.type === "fill_blank") return q.answers.map((v) => v[0]).join(" · ");
  return q.modelAnswer;
}

function ResultsStep({ quiz, generating, onRetry, onNewQuestions, onUpload }) {
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q) => quiz.answers[q.id]?.correct === true).length;
  const pct = Math.round((correct / Math.max(1, total)) * 100);
  const jq = quiz.config.difficulty === "jacqueline";
  const byType = MODE_KEYS.map((m) => {
    const qs = quiz.questions.filter((q) => q.type === m);
    return { m, total: qs.length, ok: qs.filter((q) => quiz.answers[q.id]?.correct === true).length };
  }).filter((x) => x.total);
  const verdict = pct >= 90 ? "Dominio total" : pct >= 75 ? "Muy bien" : pct >= 60 ? "Vas por buen camino" : pct >= 40 ? "Toca repasar" : "A estudiar con calma";
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return html`<div className="flex flex-col gap-4">
    <section className="card flat !rounded-3xl p-5 md:p-7 grid md:grid-cols-[auto_1fr] gap-6 items-center">
      <div className="ring-score w-44 h-44 rounded-full grid place-items-center relative mx-auto" style=${{ "--pct": pct }}>
        <div className="absolute inset-3 rounded-full" style=${{ background: "rgb(var(--surface))" }}></div>
        <div className="relative text-center"><div className="text-4xl font-extrabold mono">${pct}%</div><div className="text-xs eyebrow">efectividad</div></div>
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          ${jq ? html`<span className="jq-badge">♛ Jacqueline</span>` : html`<span className=${"pill tone-" + DIFFS[quiz.config.difficulty].tone}>Nivel ${DIFFS[quiz.config.difficulty].label}</span>`}
          <span className="chip" style=${{ color: "rgb(var(--muted))" }}>${quiz.engineLabel ? (quiz.engine === "demo" ? "Generado en modo demo local" : "Generado con " + quiz.engineLabel) : quiz.engine === "claude" ? "Generado por IA de Claude" : "Generado en modo demo local"}</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold">${verdict}</h2>
        <p className="text-lg"><b className="mono">${correct}/${total}</b> aciertos</p>
        ${jq && html`<div className="jq-card rounded-2xl p-4 flex items-center gap-4 relative border-2">
          <span className="w-14 h-14 rounded-full grid place-items-center relative z-10 shrink-0" style=${{ background: "rgb(var(--jq-gold))", color: "rgb(var(--jq-deep))", boxShadow: "0 0 24px rgb(var(--jq-gold) / .6)" }}><${Icon} name="crown" size=${28} /></span>
          <div className="relative z-10"><div className="jq-title font-extrabold text-lg" style=${{ fontFamily: "var(--font-display)" }}>${pct >= 80 ? "Insignia Maestro Jacqueline" : "Insignia Sobreviviente Jacqueline"}</div>
          <div className="jq-hint text-sm">${pct >= 80 ? "Superaste el nivel más exigente de la plataforma con dominio absoluto." : "Completaste el nivel más exigente. Llega al 80% para la insignia Maestro."}</div></div>
        </div>`}
        <div className="grid sm:grid-cols-2 gap-2">
          ${byType.map((t) => html`<div key=${t.m} className="rounded-xl p-3 border-2" style=${{ borderColor: "rgb(var(--line-soft))" }}>
            <div className="flex justify-between text-sm font-bold"><span>${MODES[t.m].label}</span><span className="mono">${t.ok}/${t.total}</span></div>
            <div className="h-2 rounded-full mt-2 overflow-hidden" style=${{ background: "rgb(var(--surface-2))" }}><div className="h-full rounded-full" style=${{ width: `${(t.ok / t.total) * 100}%`, background: `rgb(var(--${MODES[t.m].tone}-ink))` }}></div></div>
          </div>`)}
        </div>
        ${quiz.attempts?.length > 0 && html`<p className="text-sm" style=${{ color: "rgb(var(--muted))" }}>Intentos anteriores: ${quiz.attempts.map((x) => x.pct + "%").join(" · ")}</p>`}
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn btn-primary" onClick=${onRetry}><${Icon} name="refresh" size=${16} /> Reintentar con las mismas preguntas</button>
          <button className="btn btn-ghost" disabled=${!!generating} onClick=${onNewQuestions}>${generating ? html`<${Spinner} />` : html`<${Icon} name="spark" size=${16} />`} Generar nuevas preguntas de estos documentos</button>
          <button className="btn btn-ghost" onClick=${onUpload}><${Icon} name="upload" size=${16} /> Subir nuevos archivos</button>
        </div>
        ${generating && html`<p className="text-sm" style=${{ color: "rgb(var(--muted))" }}>${generating}</p>`}
      </div>
    </section>

    <section className="card p-5 md:p-6 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div><div className="eyebrow">Resumen de estudio</div><h3 className="text-xl font-bold">Revisión completa</h3></div>
        <div className="flex gap-2">
          <button className="btn btn-ghost !py-1.5 text-sm" onClick=${() => setOpen(new Set(quiz.questions.map((q) => q.id)))}>Desplegar todo</button>
          <button className="btn btn-ghost !py-1.5 text-sm" onClick=${() => setOpen(new Set())}>Plegar</button>
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        ${quiz.questions.map((q, i) => {
          const a = quiz.answers[q.id], ok = a?.correct === true, isOpen = open.has(q.id);
          return html`<li key=${q.id} className="rounded-2xl border-2 overflow-hidden" style=${{ borderColor: ok ? "rgb(var(--ok))" : a ? "rgb(var(--bad))" : "rgb(var(--line-soft))" }}>
            <button className="w-full text-left p-3 md:p-4 flex items-start gap-3" onClick=${() => toggle(q.id)} aria-expanded=${isOpen}>
              <span className="mono text-sm font-bold w-7 h-7 shrink-0 grid place-items-center rounded-md" style=${{ background: ok ? "rgb(var(--ok))" : a ? "rgb(var(--bad))" : "rgb(var(--surface-2))", color: a ? "rgb(var(--surface))" : "rgb(var(--ink))" }}>${i + 1}</span>
              <span className="min-w-0 flex-1">${q.topic && html`<span className="block eyebrow mb-1">${q.topic}</span>`}<span className=${"chip mr-2 tone-" + MODES[q.type].tone}>${MODES[q.type].label}</span><span className="font-medium">${q.prompt.length > 160 && !isOpen ? q.prompt.slice(0, 160) + "…" : q.prompt}</span></span>
              <span className="text-sm font-bold shrink-0" style=${{ color: ok ? "rgb(var(--ok))" : "rgb(var(--bad))" }}>${ok ? "✓" : a ? "✗" : "—"}</span>
            </button>
            ${isOpen && html`<div className="px-4 pb-4 grid md:grid-cols-2 gap-3 text-[15px]">
              <div className="rounded-xl p-3" style=${{ background: "rgb(var(--surface-2))" }}><div className="eyebrow mb-1">Tu respuesta</div><div className="whitespace-pre-line">${userAnswerText(q, a)}</div></div>
              <div className="rounded-xl p-3 tone-butter"><div className="eyebrow mb-1 !text-[rgb(var(--butter-ink))]">Respuesta correcta / ideal</div><div className="whitespace-pre-line text-[rgb(var(--ink))]">${correctAnswerText(q)}</div></div>
              <div className="md:col-span-2 text-sm whitespace-pre-line" style=${{ color: "rgb(var(--muted))" }}>${q.explanation}${a?.feedback ? "\nValidación IA: " + a.feedback : ""}</div>
            </div>`}
          </li>`;
        })}
      </ol>
    </section>
  </div>`;
}

// ================================================================ aplicación
const newSession = () => ({ id: uid(), title: "Nueva sesión de estudio", titleEdited: false, createdAt: Date.now(), updatedAt: Date.now(), files: [], fileCount: 0, quizzes: [], activeQuizId: null, step: "material", lastConfig: null, excluded: [] });

function App() {
  const [caps, setCaps] = useState({ ready: false, sample: null, db: null, user: null, me: null, uid: null, imgMax: 0, perms: null, perm: {} });
  // Dentro de Claude la entrada la decide la cuenta del visitante (ClaudeGate), no un acceso guardado.
  const [auth, setAuth] = useState(() => (IN_CLAUDE ? null : pref.get("smai:auth")));
  const autoEntered = useRef(false);
  const [theme, setTheme] = useState(() => pref.get("smai:theme", "system"));
  const [store, setStore] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [engine, setEngine] = useState(() => pref.get("smai:engine", IN_CLAUDE ? "claude" : "gemini"));
  const [gem, setGemState] = useState(() => geminiAccount.load());
  const setGem = (g) => { geminiAccount.save(g); setGemState(g); };
  const [api, setApi] = useState(() => apiSettings.load());
  useEffect(() => { apiSettings.save(api); }, [api]);
  const [claudeBlocked, setClaudeBlocked] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [loginNotice, setLoginNotice] = useState(null);
  const blobs = useRef(new Map());
  const processing = useRef(false);
  const savedAt = useRef(0);

  const toast = useCallback((text, tone = "sky") => {
    const id = uid();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  // Capacidades del visor: IA (sample), almacén (db) e identidad (user).
  useEffect(() => {
    (async () => {
      const c = window.claude;
      const [sample, db, user, perms] = c ? await Promise.all(["sample", "db", "user", "permissions"].map((n) => c.use(n).catch(() => null))) : [null, null, null, null];
      let me = null, imgMax = 0, perm = {};
      if (user) { try { me = await user.me(); } catch {} }
      if (sample) { try { imgMax = (await sample.limits())?.images?.maxCount || 0; } catch {} }
      // Estado de los permisos que el visitante concede a la página (para pedirlos si faltan).
      if (perms) { try { perm = (await perms.state()) || {}; } catch {} }
      setCaps({ ready: true, sample, db, user, me, uid: me?.id || null, imgMax, perms, perm });
    })();
    const onErr = (e) => toast(e.detail?.code === "quota" ? "El almacenamiento de este navegador está lleno: borra sesiones antiguas del historial." : "No se pudo guardar el último cambio. Se reintentará con el siguiente.", "rose");
    window.addEventListener("smai-save-error", onErr);
    return () => window.removeEventListener("smai-save-error", onErr);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    pref.set("smai:theme", theme);
  }, [theme]);

  // Dentro de Claude: con la cuenta disponible se entra directamente, en modo Claude y con el historial en la nube.
  const enterClaude = () => {
    const a = caps.db && caps.uid ? { mode: "account", nick: caps.me?.name || "" } : { mode: "guest", nick: caps.me?.name || "" };
    setLoginNotice(null); setEngine("claude"); pref.set("smai:engine", "claude"); setAuth(a);
    if (!caps.sample) toast("claude.ai no ofrece la IA de tu cuenta a esta página: se usa el modo demo. Mira la tarjeta «Cuenta de Claude» para conectarla.", "butter");
  };
  useEffect(() => {
    if (!IN_CLAUDE || !caps.ready || auth || autoEntered.current) return;
    autoEntered.current = true;
    enterClaude();
  }, [caps.ready]);

  // Abre el almacén según el modo de acceso elegido.
  useEffect(() => {
    if (!auth || !caps.ready) return;
    if (auth.mode === "account") {
      if (!caps.db || !caps.uid) { setLoginNotice("Tu cuenta no está disponible en esta vista. Entra como invitado o abre la página con tu cuenta de Claude iniciada."); setAuth(null); pref.del("smai:auth"); return; }
      const cloud = new CloudStore(caps.db, caps.uid);
      // Quien abre un enlace público sin permiso de escritura usa la IA de su cuenta, pero guarda el historial en su navegador.
      cloud.probe().then(() => setStore(cloud), () => { toast("Tu acceso a esta página es de solo lectura: tu historial se guardará en este navegador.", "butter"); setStore(new GuestStore()); });
    } else setStore(new GuestStore());
  }, [auth, caps.ready]);

  useEffect(() => {
    if (!store) return;
    (async () => {
      try {
        const list = await store.list();
        setSessions(list);
        const last = pref.get("smai:last:" + store.kind);
        const pick = list.find((s) => s.id === last) || null;
        if (pick) await openSession(pick.id); else setCurrent(newSession());
      } catch (e) { console.warn(e); toast("No se pudo cargar el historial.", "rose"); setCurrent(newSession()); }
    })();
  }, [store]);

  const claudeOk = IN_CLAUDE && !!caps.sample && !claudeBlocked;
  // Diagnóstico visible cuando la IA de Claude no está disponible: qué respondió el visor de claude.ai.
  const claudeDiag = !IN_CLAUDE ? "" : claudeBlocked ? "tu cuenta rechazó el uso de la IA en esta página"
    : !caps.perms ? "el visor de claude.ai no respondió a la página"
    : `IA de Claude: ${PERM_TEXT[caps.perm?.sample || "unavailable"]}`;
  const apiModels = api.models?.[api.provider] || {};
  const apiReady = !IN_CLAUDE && !!api.key.trim() && !!apiModels.text;
  const geminiReady = !IN_CLAUDE && !!gem.key && !!gem.model;
  const activeEngine = engine === "gemini" && geminiReady ? "gemini" : engine === "claude" && claudeOk ? "claude" : engine === "api" && apiReady ? "api" : "demo";
  const ai = useMemo(() => (activeEngine === "claude" ? claudeAccountAI(caps.sample, caps.imgMax)
    : activeEngine === "gemini" ? apiKeyAI({ provider: "gemini", label: "Gemini", key: gem.key, models: { text: gem.model, vision: gem.model } })
    : activeEngine === "api" ? apiKeyAI({ provider: api.provider, key: api.key.trim(), models: apiModels }) : null),
    [activeEngine, caps.sample, caps.imgMax, gem.key, gem.model, api.provider, api.key, apiModels.text, apiModels.vision]);
  const visionOk = !!ai && ai.maxImages > 0;
  const engineLabel = activeEngine === "gemini" ? "Gemini · tu cuenta" : activeEngine === "claude" ? "Claude · tu cuenta" : activeEngine === "api" ? `${PROVIDERS[api.provider].short} · tu API key` : "Demo local · sin IA";
  // Un error de cuenta/permisos desactiva Claude en esta visita; con API key se avisa y se sigue en local.
  const onAIError = (e) => { if (e && DISABLE_CODES.has(e.code)) setClaudeBlocked(true); };

  // Persistencia: guarda la sesión cuando cambia (con retardo).
  useEffect(() => {
    if (!store || !current || current.updatedAt === savedAt.current) return;
    if (!current.files.length && !current.quizzes.length) return;
    const t = setTimeout(() => {
      savedAt.current = current.updatedAt;
      const doc = { ...current, files: undefined, fileCount: current.files.filter((f) => f.status === "ready").length };
      store.saveSession(doc);
      setSessions((list) => [sessionMeta(doc), ...list.filter((s) => s.id !== doc.id)].sort((a, b) => b.updatedAt - a.updatedAt));
      pref.set("smai:last:" + store.kind, current.id);
    }, 500);
    return () => clearTimeout(t);
  }, [current, store]);

  const mutate = useCallback((fn) => setCurrent((s) => (s ? { ...fn(s), updatedAt: Date.now() } : s)), []);

  async function openSession(id) {
    const s = await store.load(id);
    if (!s) { toast("Esa sesión ya no existe.", "rose"); return; }
    s.files = (s.files || []).map((f) => (f.status === "ready" || f.status === "error" ? f : { ...f, status: "error", error: "El análisis se interrumpió. Vuelve a subir el archivo." }));
    s.excluded = s.excluded || [];
    savedAt.current = s.updatedAt;
    setCurrent(s);
    pref.set("smai:last:" + store.kind, id);
    setSideOpen(false);
  }

  // Cola de procesamiento: un archivo a la vez.
  useEffect(() => {
    if (!current || processing.current) return;
    const next = current.files.find((f) => f.status === "queued" && blobs.current.has(f.id));
    if (!next) return;
    processing.current = true;
    const sid = current.id, fid = next.id, file = blobs.current.get(fid);
    const patch = (p) => setCurrent((s) => (s && s.id === sid ? { ...s, updatedAt: p.status ? Date.now() : s.updatedAt, files: s.files.map((f) => (f.id === fid ? { ...f, ...p } : f)) } : s));
    const vision = visionOk ? aiVision(ai) : localVision();
    (async () => {
      patch({ status: "processing", progress: "Iniciando análisis" });
      let result;
      try {
        try { result = await extractFile(file, vision, (m) => patch({ progress: m })); }
        catch (e) {
          if (!visionOk || e?.code === "cancelled" || !e?.code) throw e;
          onAIError(e);
          toast(`${aiErrorText(e)} Este archivo se leyó con el OCR local.`, "peach");
          result = await extractFile(file, localVision(), (m) => patch({ progress: m }));
        }
        const rec = { ...next, status: result.sections.length ? "ready" : "error", progress: "Listo", sections: result.sections, stats: result.stats, error: result.sections.length ? undefined : "No se encontró texto legible en el archivo." };
        if (rec.status === "ready") store.saveFile(sid, rec);
        processing.current = false;
        blobs.current.delete(fid);
        patch({ status: rec.status, progress: rec.progress, sections: rec.sections, stats: rec.stats, error: rec.error });
      } catch (e) {
        console.warn(e);
        processing.current = false;
        blobs.current.delete(fid);
        patch({ status: "error", error: e?.code ? aiErrorText(e) : e?.message || "No se pudo procesar el archivo." });
      }
    })();
  }, [current, ai]);

  const addFiles = (list) => {
    const recs = list.map((f) => { const id = uid(); blobs.current.set(id, f); return { id, name: f.name, size: f.size, kind: kindOf(f.name), status: "queued", progress: "En cola", sections: [], stats: {}, addedAt: Date.now() }; });
    mutate((s) => {
      const files = [...s.files, ...recs];
      const base = files[0].name.replace(/\.[^.]+$/, "");
      return { ...s, files, title: s.titleEdited ? s.title : files.length > 1 ? `${base} +${files.length - 1}` : base };
    });
  };
  const addSample = () => {
    const f = new File([SAMPLE_DOC.text], SAMPLE_DOC.name, { type: "text/plain" });
    addFiles([f]);
    toast("Se cargó un texto de ejemplo sobre la célula, marcado como «Ejemplo».", "butter");
  };
  const removeFile = (id) => { blobs.current.delete(id); store?.deleteFile(id).catch(() => {}); mutate((s) => ({ ...s, files: s.files.filter((f) => f.id !== id), excluded: s.excluded.filter((x) => x !== id) })); };
  const toggleFile = (id) => mutate((s) => ({ ...s, excluded: s.excluded.includes(id) ? s.excluded.filter((x) => x !== id) : [...s.excluded, id] }));

  const quiz = current?.quizzes.find((q) => q.id === current.activeQuizId) || null;
  const busy = !!current?.files.some((f) => f.status === "queued" || f.status === "processing");

  async function generate(cfg) {
    const excluded = new Set(current.excluded);
    const files = current.files.filter((f) => f.status === "ready" && !excluded.has(f.id));
    const avoid = current.quizzes.flatMap((q) => q.questions.map((x) => x.prompt));
    setGenerating(ai ? `${ai.label} está leyendo tu material…` : "Generando preguntas con el motor demo local…");
    try {
      let res, used = engineLabel;
      if (ai) {
        try { res = await aiGenerate(ai, files, cfg, avoid, setGenerating); }
        catch (e) {
          if (e && DISABLE_CODES.has(e.code)) { onAIError(e); toast(aiErrorText(e), "peach"); res = generateLocal(files, cfg); used = "Demo local · sin IA"; }
          else throw e;
        }
      } else { await sleep(250); res = generateLocal(files, cfg); }
      if (res.questions.length < cfg.count) toast(`Se generaron ${res.questions.length} de ${cfg.count} preguntas con el material disponible.`, "butter");
      if (res.coverage < 100) toast(`Tu material es extenso: se usó ~${res.coverage}% del texto, muestreado de todas las secciones.`, "butter");
      const q = { id: uid(), createdAt: Date.now(), engine: used.startsWith("Demo") ? "demo" : "ai", engineLabel: used, config: cfg, questions: res.questions, answers: {}, current: 0, finishedAt: null, pct: 0, attempts: [] };
      mutate((s) => ({ ...s, quizzes: [...s.quizzes, q], activeQuizId: q.id, step: "quiz", lastConfig: cfg }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.warn(e);
      toast(e?.code ? aiErrorText(e) : e?.message || "No se pudo generar el test.", "rose");
    } finally { setGenerating(null); }
  }

  const updQuiz = (fn) => mutate((s) => ({ ...s, quizzes: s.quizzes.map((q) => (q.id === s.activeQuizId ? fn(q) : q)) }));
  const setAnswer = (qid, ans) => updQuiz((q) => ({ ...q, answers: { ...q.answers, [qid]: { ...(q.answers[qid] || {}), ...ans } } }));
  const onChoice = (qid, given) => {
    const q = quiz.questions.find((x) => x.id === qid);
    if (quiz.answers[qid]) return;
    setAnswer(qid, { given, correct: q.type === "multiple_choice" ? given === q.answerIndex : given === q.answerBool, method: "auto" });
  };
  const onSubmitText = (qid, given) => setAnswer(qid, { given, submitted: true, correct: null });
  const onSelfEval = (qid, ok) => setAnswer(qid, { correct: ok, method: "self" });
  const onAIValidate = async (qid) => {
    const q = quiz.questions.find((x) => x.id === qid), a = quiz.answers[qid];
    const given = q.type === "fill_blank" ? a.given.map((v, i) => `Hueco ${i + 1}: ${v || "(vacío)"}`).join("\n") : a.given;
    try { const r = await aiValidate(ai, q, given, quiz.config.difficulty); setAnswer(qid, { correct: r.correct, feedback: r.feedback, method: "ai" }); }
    catch (e) { onAIError(e); toast(aiErrorText(e) + " Usa la autoevaluación.", "peach"); }
  };
  const onNext = () => updQuiz((q) => {
    if (q.current < q.questions.length - 1) return { ...q, current: q.current + 1 };
    const ok = q.questions.filter((x) => q.answers[x.id]?.correct === true).length;
    return { ...q, finishedAt: Date.now(), pct: Math.round((ok / q.questions.length) * 100) };
  });
  useEffect(() => { if (quiz?.finishedAt && current.step === "quiz") mutate((s) => ({ ...s, step: "results" })); }, [quiz?.finishedAt]);
  const onRetry = () => { updQuiz((q) => ({ ...q, attempts: q.finishedAt ? [...q.attempts, { pct: q.pct, at: q.finishedAt }] : q.attempts, answers: {}, current: 0, finishedAt: null, pct: 0, questions: shuffle(q.questions) })); mutate((s) => ({ ...s, step: "quiz" })); };

  // ------------------------------------------------------------------ render
  if (!auth) return IN_CLAUDE
    ? html`<${ClaudeGate} caps=${caps} notice=${loginNotice} onEnter=${enterClaude} />`
    : html`<${LoginScreen} notice=${loginNotice} onChoose=${(a) => { pref.set("smai:auth", a); setLoginNotice(null); setAuth(a); }} />`;
  if (!current) return html`<div className="h-full grid place-items-center"><span className="flex items-center gap-3 font-bold"><${Spinner} /> Cargando tu historial…</span></div>`;

  const readyCount = current.files.filter((f) => f.status === "ready").length;
  const enabled = { material: true, config: readyCount > 0, quiz: !!quiz, results: !!quiz && (!!quiz.finishedAt || quiz.attempts.length > 0) };
  const step = enabled[current.step] ? current.step : "material";
  const goStep = (k) => mutate((s) => ({ ...s, step: k }));
  const jqTheme = quiz && (step === "quiz" || step === "results") && quiz.config.difficulty === "jacqueline";

  return html`<div className=${"shell flex gap-4 min-h-full " + (jqTheme ? "theme-jq" : "")}>
    ${sideOpen && html`<div className="fixed inset-0 z-30 lg:hidden" style=${{ background: "rgb(var(--ink) / .35)" }} onClick=${() => setSideOpen(false)}></div>`}
    <${Sidebar} auth=${auth} caps=${caps} storeKind=${store?.kind} engineLabel=${engineLabel} sessions=${sessions} currentId=${current.id} busy=${busy} open=${sideOpen} onClose=${() => setSideOpen(false)}
      onSelect=${(id) => id !== current.id && openSession(id)} onNew=${() => { setCurrent(newSession()); setSideOpen(false); }}
      onDelete=${async (id) => { try { await store.remove(id); } catch {} setSessions((l) => l.filter((s) => s.id !== id)); if (id === current.id) setCurrent(newSession()); toast("Sesión eliminada.", "sky"); }}
      theme=${theme} onTheme=${() => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"))}
      onLogout=${() => { pref.del("smai:auth"); setAuth(null); setStore(null); setCurrent(null); setSessions([]); }} />
    <main className="flex-1 min-w-0 flex flex-col gap-5 pb-10">
      <${Header} session=${current} step=${step} enabled=${enabled} onStep=${goStep} onMenu=${() => setSideOpen(true)} modeLabel=${engineLabel} modeKind=${activeEngine}
        onRename=${(t) => mutate((s) => ({ ...s, title: t, titleEdited: true }))} />
      ${step === "material" && html`<${MaterialStep} session=${current} onFiles=${addFiles} onSample=${addSample} onRemove=${removeFile} onToggle=${toggleFile} onNext=${() => goStep("config")}
        modePanel=${html`<${ModePanel} mode=${engine} onMode=${(e) => { setEngine(e); pref.set("smai:engine", e); }} claudeOk=${claudeOk} claudeVision=${caps.imgMax > 0} claudeDiag=${claudeDiag} api=${api} setApi=${setApi} apiReady=${apiReady} gem=${gem} setGem=${setGem} geminiReady=${geminiReady} />`} />`}
      ${step === "config" && html`<${ConfigStep} key=${current.id} session=${current} engineLabel=${engineLabel} generating=${generating} onGenerate=${generate} />`}
      ${step === "quiz" && quiz && html`<${QuizStep} quiz=${quiz} aiOk=${!!ai} onChoice=${onChoice} onSubmitText=${onSubmitText} onSelfEval=${onSelfEval} onAIValidate=${onAIValidate} onNext=${onNext} onExit=${() => goStep("config")} />`}
      ${step === "results" && quiz && html`<${ResultsStep} quiz=${quiz} generating=${generating} onRetry=${onRetry} onNewQuestions=${() => generate(quiz.config)} onUpload=${() => goStep("material")} />`}
    </main>
    <div className="fixed z-50 flex flex-col gap-2 items-end" style=${{ right: "max(16px, env(safe-area-inset-right, 0px))", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", maxWidth: "min(420px, calc(100vw - 32px))" }} aria-live="polite">
      ${toasts.map((t) => html`<div key=${t.id} className=${"flat rounded-xl px-4 py-3 text-sm font-bold pop tone-" + t.tone}>${t.text}</div>`)}
    </div>
  </div>`;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR + "pdf.worker.min.js";
ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
