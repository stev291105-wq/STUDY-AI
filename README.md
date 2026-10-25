# StudyMaster AI

Convierte tus apuntes en cuestionarios. Sube PDF, Word, PowerPoint, exportaciones de Google Docs o Canva y fotos de cuadernos o pizarras. StudyMaster lee el texto, las imágenes y la letra a mano, y genera preguntas de selección múltiple, verdadero o falso, completar y desarrollo, en cuatro niveles: Fácil, Medio, Difícil y **Jacqueline** (maestro/extremo).

**Web:** https://stev291105-wq.github.io/STUDY-AI/

## Cuatro formas de usarlo

| Modo | Qué necesita | Cómo funciona |
|---|---|---|
| **1. With Gemini** ★ recomendado | Una cuenta de Google | Panel guiado de 3 pasos: «Iniciar sesión en Google AI Studio» → «Create API key» (gratis) → pegar la key. La página la valida sola listando tus modelos, muestra «Conectado con tu cuenta de Google ✓» y elige un modelo Gemini Flash. Lee imágenes y letra a mano, genera preguntas y valida respuestas. |
| **2. Cuenta de Claude** | Una cuenta de Claude | El botón «Entrar con mi cuenta de Claude» abre StudyMaster dentro de [claude.ai](https://claude.ai/artifact/92VXBGiiXZfxxjK2iSa3Fg). La persona inicia sesión con su correo y la IA usa **su propia cuenta** (sin API key). |
| **3. Demo local** | Nada | Todo ocurre en el navegador: PDF.js, Mammoth y JSZip extraen el texto, Tesseract.js lee el texto impreso de las imágenes y las preguntas se generan con reglas. Sin IA y sin enviar archivos a ningún sitio. |
| **4. Mi API key** | Una key de Gemini, Groq o xAI | Eliges **Google Gemini**, **Llama (vía Groq)** o **Grok (xAI)**, pegas tu key y pulsas «Probar conexión». La página lista tus modelos y elige uno para texto y otro para imágenes. |

La cabecera muestra siempre el modo activo (por ejemplo «Gemini · tu cuenta»). Si tu cuenta gratuita de Gemini llega a su límite (error 429), la página avisa: «Alcanzaste el límite gratuito de tu cuenta de Gemini; espera un minuto o usa el modo Demo local (sin IA)».

Dónde conseguir una key: [Google AI Studio](https://aistudio.google.com/apikey) (Gemini, con plan gratuito) · [Groq](https://console.groq.com/keys) (Llama, con plan gratuito) · [xAI](https://console.x.ai) (Grok, de pago).

> Las keys se guardan solo en tu navegador: en la sesión (sessionStorage) por defecto, o de forma permanente (localStorage) si marcas «Recordar»; «Desconectar» la borra. Este sitio no tiene servidor: nadie más la ve. Aun así, en Google Cloud puedes restringir tu key de Gemini a este dominio.

## Funciones

- Carga ilimitada de archivos y carpetas (arrastrar y soltar): PDF, DOCX, PPTX, PNG, JPG, WEBP, GIF, TXT/MD/CSV.
- OCR de imágenes incrustadas y páginas escaneadas; lectura de manuscritos con IA (modos 2 y 3).
- Hasta 3 modalidades combinadas (la cuarta se bloquea), 4 niveles de dificultad y de 1 a 100 preguntas.
- Cada pregunta muestra encima la **temática** del documento a la que pertenece (título del apartado, diapositiva o capítulo).
- Preguntas con sentido: las opciones incorrectas concuerdan con la correcta, las afirmaciones falsas cambian un dato concreto y nunca se mezclan documentos distintos.
- Corrección inmediata en selección múltiple y V/F; en completar y abiertas se muestra la **respuesta oficial del documento** con autoevaluación («✅ Respondí bien» / «❌ Me equivoqué») o validación con IA.
- Resultados con porcentaje, estadísticas por tipo, insignia Jacqueline y revisión completa.
- Historial de sesiones en la barra lateral, tema claro/oscuro y diseño adaptado al móvil.

Los formatos antiguos `.doc` y `.ppt` no se pueden leer en el navegador: guárdalos como `.docx`/`.pptx` o PDF.

## Estructura

```
index.html            página (GitHub Pages)
assets/app.js|css     aplicación compilada
vendor/               librerías locales (React, htm, JSZip, Mammoth, PDF.js, Tesseract.js + datos de español e inglés)
src/                  código fuente
  core.js             almacenamiento, extracción, motor demo y motores de IA
  providers.js        modos de uso: cuenta de Claude y API key (Gemini, Groq, xAI)
  ui.js               interfaz (React + htm)
  input.css           estilos (Tailwind CSS)
build.mjs             compila la web y la versión para Claude
```

## Compilar

```bash
npm install
npm run build      # regenera assets/ e index.html (y dist-claude/ para la versión de Claude)
npm run serve      # http://localhost:8080
```

Nota: `vendor/tesseract/worker.min.js` incluye un parche de una línea (Tesseract.js 5.1.1 usaba `l.data` en vez de `l.code` al iniciar idiomas cargados por la página).
