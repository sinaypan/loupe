// La loupe : injectée dans la page quand on la demande. Le survol encadre un
// élément, un clic ouvre sa fiche : d'où il vient, ce qu'il pèse, comment il
// est dessiné, et de quoi le télécharger. Le fond (background.js) fait ce que
// la page ne peut pas : interroger le serveur, enregistrer, photographier.
(() => {
  // Deuxième appel pendant qu'elle est déjà en main : on la repose.
  if (globalThis.loupeStop) {
    globalThis.loupeStop();
    return;
  }

  const SVG = 'http://www.w3.org/2000/svg';
  const KINDS = { aside: 'Colonne', header: 'En-tête', footer: 'Pied de page', nav: 'Menu', dialog: 'Fenêtre', form: 'Formulaire', button: 'Bouton', a: 'Lien', ul: 'Liste', ol: 'Liste', li: 'Ligne', article: 'Article', table: 'Tableau' };
  const LABELS = { image: 'Image', video: 'Vidéo', audio: 'Son', frame: 'Cadre', canvas: 'Dessin du site', drawing: 'Dessin', text: 'Texte' };
  const FORMATS = { jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', apng: 'PNG animé', gif: 'GIF', webp: 'WebP', avif: 'AVIF', svg: 'SVG', 'svg+xml': 'SVG', bmp: 'BMP', ico: 'ICO', 'x-icon': 'ICO', 'vnd.microsoft.icon': 'ICO', tif: 'TIFF', tiff: 'TIFF', mp4: 'MP4', m4v: 'MP4', webm: 'WebM', ogv: 'Ogg', mov: 'QuickTime', quicktime: 'QuickTime', mp3: 'MP3', mpeg: 'MP3', m4a: 'M4A', aac: 'AAC', ogg: 'Ogg', oga: 'Ogg', opus: 'Opus', wav: 'WAV', 'x-wav': 'WAV', flac: 'FLAC', weba: 'WebM' };
  const WEIGHTS = { 100: 'Fin', 200: 'Très léger', 300: 'Léger', 400: 'Normal', 500: 'Moyen', 600: 'Demi-gras', 700: 'Gras', 800: 'Très gras', 900: 'Noir' };
  const GENERIC = { serif: 'Police à empattements du système', 'sans-serif': 'Police sans empattements du système', monospace: 'Police à chasse fixe du système', 'system-ui': 'Police du système', 'ui-sans-serif': 'Police du système', 'ui-serif': 'Police à empattements du système', 'ui-monospace': 'Police à chasse fixe du système', 'ui-rounded': 'Police arrondie du système', cursive: 'Police manuscrite du système', fantasy: 'Police fantaisie du système', emoji: 'Police d’émojis', math: 'Police mathématique' };
  const PROTOCOLS = { h2: 'HTTP/2', h3: 'HTTP/3', 'http/1.1': 'HTTP/1.1', 'http/1.0': 'HTTP/1.0' };

  const CSS_TEXT = `
    :host {
      --card: #ffffff;
      --text: #1c1c1e;
      --muted: #8e8e93;
      --field: #f2f2f7;
      --accent: #ff2d55;
      --accent-text: #ffffff;
      --error: #c0271d;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(60, 60, 67, 0.12);
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --card: #2c2c2e;
        --text: #f2f2f7;
        --field: #3a3a3c;
        --accent: #ff375f;
        --error: #ff6961;
        --shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(235, 235, 245, 0.12);
      }
    }
    .shield {
      position: fixed;
      inset: 0;
      pointer-events: auto;
      cursor: crosshair;
    }
    .box {
      position: fixed;
      box-sizing: border-box;
      border: 2px solid var(--accent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      pointer-events: none;
    }
    .box.kept {
      background: none;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 26%, transparent);
    }
    .tag {
      position: fixed;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-text);
      font: 600 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      pointer-events: none;
    }
    .bar,
    .card {
      position: fixed;
      box-sizing: border-box;
      background: var(--card);
      color: var(--text);
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: var(--shadow);
      pointer-events: auto;
      cursor: default;
    }
    .bar {
      left: 50%;
      top: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100vw - 24px);
      padding: 8px 8px 8px 16px;
      transform: translateX(-50%);
      border-radius: 999px;
    }
    .bar.low {
      top: auto;
      bottom: 20px;
    }
    .message {
      margin-right: 6px;
      font-weight: 600;
      white-space: nowrap;
    }
    .hint {
      margin-left: 8px;
      color: var(--muted);
      font-weight: 400;
    }
    button {
      flex: none;
      margin: 0;
      padding: 7px 14px;
      border: 0;
      border-radius: 999px;
      background: var(--field);
      color: var(--text);
      font: inherit;
      white-space: nowrap;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    button.main {
      background: var(--accent);
      color: var(--accent-text);
      font-weight: 600;
    }
    button.round {
      display: flex;
      padding: 7px;
      background: none;
      color: var(--muted);
    }
    button.round:hover {
      background: var(--field);
      color: var(--text);
    }
    .bar .round {
      margin-left: -8px;
    }
    svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .card {
      width: 320px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
      padding: 12px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--muted) transparent;
      border-radius: 14px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chip {
      padding: 3px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 22%, var(--field));
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .dims {
      flex: 1;
      overflow: hidden;
      color: var(--muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .head .round {
      margin: -4px -4px -4px 0;
    }
    .site {
      margin: 10px 2px 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.25;
      overflow-wrap: anywhere;
      user-select: text;
    }
    .path,
    .note {
      margin: 3px 2px 0;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .path {
      user-select: text;
    }
    .path b {
      color: var(--text);
      font-weight: 600;
    }
    .list {
      margin-top: 10px;
      padding: 2px 12px;
      border-radius: 12px;
      background: var(--field);
    }
    .row {
      display: flex;
      width: 100%;
      align-items: baseline;
      gap: 12px;
      padding: 7px 0;
      border-radius: 0;
      background: none;
      text-align: left;
      white-space: normal;
    }
    .row:not(:first-child) {
      border-top: 1px solid color-mix(in srgb, var(--muted) 26%, transparent);
    }
    .row .label {
      flex: none;
      color: var(--muted);
    }
    .row .value {
      flex: 1;
      min-width: 0;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
      text-align: right;
      user-select: text;
    }
    .row.tall {
      display: block;
    }
    .row.tall .value {
      display: block;
      max-height: 84px;
      margin-top: 2px;
      overflow-y: auto;
      scrollbar-width: thin;
      font-size: 12px;
      text-align: left;
    }
    .row.item .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: var(--text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row.item .value {
      flex: none;
      color: var(--muted);
      user-select: none;
    }
    .row.item:hover .label {
      color: var(--accent);
    }
    .path button {
      padding: 0;
      border-radius: 4px;
      background: none;
      color: var(--accent);
      font-weight: 600;
    }
    .row.fold .value {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
    }
    .row.fold.open svg {
      transform: rotate(180deg);
    }
    .dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 6px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.45);
      vertical-align: -1px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .actions button {
      flex: 1;
    }
    .actions .main {
      flex: 1 0 100%;
      padding: 9px 14px;
    }
    .status {
      margin: 8px 2px 0;
      color: var(--muted);
      font-size: 12px;
    }
    .status.error {
      color: var(--error);
    }
    .status button {
      padding: 0;
      background: none;
      color: var(--accent);
      font-weight: 600;
    }
    [hidden] {
      display: none !important;
    }
  `;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const icon = (shape) => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const strokes = document.createElementNS(SVG, 'path');
    strokes.setAttribute('d', shape);
    svg.append(strokes);
    return svg;
  };
  const roundButton = (title, shape) => {
    const button = element('button', 'round');
    button.title = title;
    button.setAttribute('aria-label', title);
    button.append(icon(shape));
    return button;
  };

  const host = document.createElement('div');
  host.style.cssText = 'all: initial !important; position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important;';
  // Fermé : la page ne peut ni lire la fiche ni piloter la loupe.
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS_TEXT);
  root.adoptedStyleSheets = [sheet];

  // Une vitre posée sur toute la page : c'est elle qui reçoit la souris. Sans
  // elle, un clic sur un lien l'ouvrirait, et un clic dans un cadre venu d'un
  // autre site lui parviendrait directement.
  const shield = element('div', 'shield');
  const box = element('div', 'box');
  const kept = element('div', 'box kept');
  const tag = element('div', 'tag');
  const message = element('span', 'message');
  message.append('Clique sur ce que tu veux connaître', element('span', 'hint', '↑ ↓ pour viser plus large'));
  const doneButton = element('button', 'main', 'Terminé');
  // La barre couvre forcément un bout de page : ce bouton l'envoie de l'autre côté.
  const sideButton = roundButton('Déplacer la barre', 'M5 6l3-3 3 3M5 10l3 3 3-3');
  const bar = element('div', 'bar');
  bar.append(sideButton, message, doneButton);

  const chip = element('span', 'chip');
  const dims = element('span', 'dims');
  const closeButton = roundButton('Fermer la fiche', 'M4 4l8 8M12 4l-8 8');
  const head = element('div', 'head');
  head.append(chip, dims, closeButton);
  const site = element('div', 'site');
  const path = element('div', 'path');
  const note = element('div', 'note');
  const list = element('div', 'list');
  const actions = element('div', 'actions');
  const status = element('div', 'status');
  status.setAttribute('role', 'status');
  const card = element('div', 'card');
  card.append(head, site, path, note, list, actions, status);
  card.hidden = true;
  root.append(shield, kept, box, tag, bar, card);

  let target = null; // l'élément encadré sous la souris
  let trail = []; // de l'élément visé à ses parents, pour élargir avec ↑
  let depth = 0;
  let pointer = null; // dernière position connue de la souris
  let picked = null; // { node, view } : l'élément dont la fiche est ouverte
  let ticket = 0; // une réponse du serveur arrivée après un autre clic ne compte plus

  // ---------------------------------------------------------------- écriture

  const number = (value, digits = 0) => Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits });
  const weigh = (bytes) => {
    if (bytes < 1024) return `${number(bytes)} octets`;
    if (bytes < 1024 ** 2) return `${number(bytes / 1024, bytes < 10240 ? 1 : 0)} Ko`;
    if (bytes < 1024 ** 3) return `${number(bytes / 1024 ** 2, 1)} Mo`;
    return `${number(bytes / 1024 ** 3, 2)} Go`;
  };
  const pixels = (value) => `${number(parseFloat(value), 1)} px`;
  const sized = (width, height) => `${number(Math.round(width))} × ${number(Math.round(height))}`;
  const day = (time) => new Date(time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const lasting = (seconds) => {
    const total = Math.round(seconds);
    const two = (value) => String(value).padStart(2, '0');
    const hours = Math.floor(total / 3600);
    if (total < 60) return `${total} s`;
    return hours ? `${hours} h ${two(Math.floor((total % 3600) / 60))} min ${two(total % 60)} s` : `${Math.floor(total / 60)} min ${two(total % 60)} s`;
  };
  const tidy = (text) => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  };
  const short = (text, most) => (text.length > most ? `${text.slice(0, most - 1)}…` : text);
  const web = (address) => /^https?:/i.test(address);

  // L'adresse en morceaux lisibles : le site, les dossiers, le fichier.
  const pieces = (address) => {
    const url = new URL(address);
    const folders = url.pathname.split('/').filter(Boolean).map(tidy);
    const file = folders.pop() ?? '';
    const shown = folders.length > 4 ? [...folders.slice(0, 2), '…', folders.at(-1)] : folders;
    const extras = [...url.searchParams].length;
    const parts = shown.map((folder) => `${short(folder, 28)} › `);
    if (file) parts.push(element('b', '', short(file, 70)));
    if (extras) parts.push(`  + ${extras} paramètre${extras > 1 ? 's' : ''}`);
    return { site: url.hostname.replace(/^www\./, ''), parts };
  };

  const formatOf = (type, address) => {
    const told = FORMATS[(type ?? '').split('/')[1]];
    if (told) return told;
    try {
      return FORMATS[/\.([a-z0-9]{2,5})$/i.exec(new URL(address).pathname)?.[1].toLowerCase()] ?? '';
    } catch {
      return '';
    }
  };

  // Le nom donné au fichier enregistré : celui qu'il porte sur le serveur,
  // sinon ce que la page en dit.
  const nameFor = (address, said) => {
    if (web(address)) {
      const last = tidy(new URL(address).pathname.split('/').filter(Boolean).pop() ?? '');
      if (last) return last;
    }
    return said?.trim() || document.title || location.hostname;
  };

  // --------------------------------------------------------------- couleurs

  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;

  // Une couleur CSS, quelle que soit son écriture, en rouge, vert, bleu et opacité.
  const colorOf = (css) => {
    const plain = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(css);
    if (plain) return { r: Math.round(plain[1]), g: Math.round(plain[2]), b: Math.round(plain[3]), a: plain[4] === undefined ? 1 : Number(plain[4]) };
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  const colorRow = (label, css) => {
    const color = colorOf(css);
    if (!color.a) return { label, value: '' };
    const code = hex(color);
    return { label, value: color.a < 0.995 ? `${code} · ${number(color.a * 100)} %` : code, color: code, paint: css };
  };

  // ----------------------------------------------------------------- la page

  const parentOf = (node) => node.parentElement ?? (node.getRootNode() instanceof ShadowRoot ? node.getRootNode().host : null);
  const innerRoot = (node) => {
    try {
      return node.shadowRoot ?? chrome.dom?.openOrClosedShadowRoot(node) ?? null;
    } catch {
      return null;
    }
  };
  const absolute = (address) => {
    try {
      return new URL(address, document.baseURI).href;
    } catch {
      return '';
    }
  };

  const FIELD = 'input:not([type="image"], [type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"], [type="hidden"]), textarea, select';
  const hasText = (node) => node.matches(FIELD) || (!node.matches('script, style, noscript') && [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.data.trim()));
  const textOf = (node) => (node.matches(FIELD) ? node.value || node.placeholder || '' : node.innerText ?? node.textContent ?? '').trim();

  // La souris est-elle sur les lettres mêmes de cet élément ?
  const wordsAt = (node, x, y) => {
    const range = document.createRange();
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE || !child.data.trim()) continue;
      range.selectNodeContents(child);
      for (const rect of range.getClientRects()) {
        if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) return true;
      }
    }
    return false;
  };

  const urlIn = (value) => /url\(\s*(["']?)(.*?)\1\s*\)/.exec(value)?.[2] ?? '';
  // L'image de fond d'un élément, y compris celle posée par ses décorations.
  const backgroundOf = (node) => {
    for (const pseudo of [null, '::before', '::after']) {
      const style = getComputedStyle(node, pseudo);
      if (pseudo && style.content === 'none') continue;
      const found = urlIn(style.backgroundImage) || (pseudo ? urlIn(style.content) : '');
      if (found) return found;
    }
    return '';
  };

  // Les versions qu'une image propose (srcset) : adresse et taille annoncée.
  const offers = (srcset) => {
    const found = [];
    const tokens = srcset.trim().split(/\s+/).filter(Boolean);
    for (let at = 0; at < tokens.length; at++) {
      let url = tokens[at];
      let value = 1;
      if (url.endsWith(',')) {
        url = url.replace(/,+$/, '');
      } else {
        while (at + 1 < tokens.length) {
          let next = tokens[++at];
          // « 2x,autre.jpg » : la virgule sépare même sans espace
          const comma = next.indexOf(',');
          if (comma >= 0 && comma < next.length - 1) {
            tokens.splice(at + 1, 0, next.slice(comma + 1));
            next = next.slice(0, comma + 1);
          }
          const match = /^([\d.]+)[wx],?$/.exec(next);
          if (match) value = Number(match[1]);
          if (next.endsWith(',')) break;
        }
      }
      const address = absolute(url);
      if (address) found.push({ url: address, value });
    }
    return found;
  };

  // La plus grande version de l'image que la page propose, si ce n'est pas celle affichée.
  const largerOf = (image) => {
    const shown = image.currentSrc || image.src;
    // Wikipédia affiche une vignette : l'original est à la même adresse, sans « thumb ».
    const wiki = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/(wikipedia\/[^/]+)\/thumb\/([0-9a-f]\/[0-9a-f]{2}\/[^/]+\.(?:jpe?g|png|gif|webp|svg))\/[^/?]+(?:\?.*)?$/i.exec(shown);
    if (wiki) return `https://upload.wikimedia.org/${wiki[1]}/${wiki[2]}`;
    const sources = image.parentElement?.localName === 'picture' ? [...image.parentElement.querySelectorAll('source')] : [];
    const sets = [...sources, image].map((node) => offers(node.srcset ?? ''));
    const set = sets.find((entries) => entries.some((entry) => entry.url === shown));
    if (!set) return '';
    const best = set.reduce((first, second) => (second.value > first.value ? second : first));
    return best.url === shown ? '' : best.url;
  };

  // Ce que l'élément montre, s'il montre un fichier ou un dessin ; sinon rien.
  const mediaOf = (node) => {
    const name = node.localName;
    if (name === 'img' || (name === 'input' && node.type === 'image')) {
      // Avec plusieurs versions (srcset), Chrome annonce une taille déjà réduite : on relira le fichier.
      const scaled = Boolean(node.srcset) || node.parentElement?.localName === 'picture';
      return { kind: 'image', url: node.currentSrc || node.src || '', width: scaled ? 0 : node.naturalWidth, height: scaled ? 0 : node.naturalHeight, said: node.alt, larger: largerOf(node) };
    }
    if (name === 'image' && node.ownerSVGElement) return { kind: 'image', url: absolute(node.href?.baseVal ?? ''), said: '' };
    if (name === 'video' || name === 'audio') return { kind: name, url: node.currentSrc || node.src || absolute(node.querySelector('source')?.getAttribute('src') ?? ''), width: node.videoWidth, height: node.videoHeight, time: node.duration };
    if (name === 'iframe' || name === 'embed') return { kind: 'frame', url: node.src || '' };
    if (name === 'object') return { kind: 'frame', url: absolute(node.data ?? '') };
    if (name === 'canvas') return { kind: 'canvas', width: node.width, height: node.height };
    if (name === 'svg') return { kind: 'drawing' };
    const back = backgroundOf(node);
    return back ? { kind: 'image', url: back, back: true, said: node.getAttribute('aria-label') ?? '' } : null;
  };

  // Un trait d'un dessin SVG : c'est le dessin entier qu'on vise. Une balise
  // <picture> : l'image qu'elle contient.
  const whole = (node) => {
    if (node.localName === 'picture') return node.querySelector('img') ?? node;
    if (node.localName === 'image' && node.href?.baseVal) return node;
    let drawing = node.ownerSVGElement;
    while (drawing?.ownerSVGElement) drawing = drawing.ownerSVGElement;
    return drawing ?? node;
  };

  const subjectOf = (node, at) => {
    const media = mediaOf(node);
    const text = hasText(node);
    // Un fond imagé avec du texte dessus : le texte si la souris est sur les lettres.
    if (media && !(text && media.back && at && wordsAt(node, at.x, at.y))) return media;
    return { kind: text ? 'text' : 'block' };
  };

  // L'élément dessine-t-il lui-même quelque chose : un fond, un bord, une ombre ?
  const paints = (node) => {
    const style = getComputedStyle(node);
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((edge) => parseFloat(style[`border${edge}Width`]) > 0 && style[`border${edge}Style`] !== 'none');
    return border || style.backgroundImage !== 'none' || style.boxShadow !== 'none' || colorOf(style.backgroundColor).a > 0;
  };

  // L'élément à viser sous ce point. Ce qui est tout au-dessus est souvent une
  // couche invisible posée sur l'image ou la vidéo : on regarde donc dessous,
  // jusqu'à la première couche qui cache vraiment le reste.
  const pickAt = (x, y) => {
    let stack = document.elementsFromPoint(x, y).filter((found) => found !== host);
    for (let inner; stack[0] && (inner = innerRoot(stack[0])); ) {
      const inside = inner.elementsFromPoint(x, y).filter((found) => found.getRootNode() === inner);
      if (!inside.length) break;
      stack = [...inside, ...stack];
    }
    stack = stack.filter((found) => found !== document.documentElement);
    for (const [index, found] of stack.slice(0, 8).entries()) {
      const node = whole(found);
      const media = mediaOf(node);
      const text = hasText(found) && (index === 0 || wordsAt(found, x, y));
      if (media && !(text && media.back && wordsAt(found, x, y))) return node;
      if (text) return found;
      if (colorOf(getComputedStyle(found).backgroundColor).a > 0.95) break;
    }
    const top = stack[0];
    if (!top || top === document.body) return null;
    // Une image ou un dessin que la page a rendu insensible à la souris (les
    // icônes, souvent) n'est pas dans la pile : on le cherche dans l'élément visé.
    const deaf = [...top.querySelectorAll('img, svg, video, canvas')]
      .slice(0, 300)
      .filter((found) => {
        const rect = found.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom && getComputedStyle(found).visibility !== 'hidden';
      })
      .sort((first, second) => first.clientWidth * first.clientHeight - second.clientWidth * second.clientHeight)[0];
    if (deaf) return whole(deaf);
    if (paints(top)) return top;
    // Une enveloppe qui ne dessine rien : le bloc visible le plus proche, s'il reste petit.
    let shell = top;
    for (let step = 0; step < 6 && (shell = parentOf(shell)) && shell !== document.body; step++) {
      const rect = shell.getBoundingClientRect();
      if (paints(shell)) return rect.width * rect.height <= innerWidth * innerHeight * 0.3 ? shell : top;
    }
    return top;
  };

  // ------------------------------------------------------------------ polices

  const measure = (font) => {
    probe.font = font;
    return probe.measureText('mmmmmmmmlliWQ@0189 gjpq').width;
  };
  const families = (value) => (value.match(/("[^"]*"|'[^']*'|[^,])+/g) ?? []).map((name) => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  // La police est-elle là (installée, ou chargée par le site) ? Si elle
  // manque, Chrome écrit avec la suivante : la largeur d'un texte le trahit.
  const present = (family, style) => {
    if (GENERIC[family.toLowerCase()]) return true;
    const name = `"${family.replace(/["\\]/g, '')}"`;
    return ['monospace', 'serif'].some((base) => measure(`${style} 40px ${name}, ${base}`) !== measure(`${style} 40px ${base}`));
  };

  // ------------------------------------------------------------------- fiche

  const send = (request) =>
    chrome.runtime.sendMessage(request).catch(() => ({ ok: false, why: 'Loupe vient d’être rechargée. Recharge la page (F5), puis reprends la loupe.' }));

  const say = (text, error, extra) => {
    status.className = error ? 'status error' : 'status';
    status.replaceChildren(text, ...(extra ? ['  ', extra] : []));
    place();
  };

  const copy = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // page sans presse-papiers moderne (http) : l'ancienne méthode
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position: fixed; opacity: 0;';
      document.documentElement.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) return say('Chrome n’a pas laissé copier.', true);
    }
    say(done);
  };

  // Après un enregistrement : où il est, et de quoi l'ouvrir.
  const told = (result, extra = '') => {
    if (!result?.ok) return say(result?.why ?? 'L’enregistrement a échoué.', true);
    const open = element('button', '', 'Afficher dans le dossier');
    open.addEventListener('click', () => send({ loupe: 'show', id: result.id }));
    say(`${result.done ? 'Enregistré' : 'Téléchargement en cours'} dans Téléchargements › Loupe.${extra}`, false, open);
  };

  const frames = (count) => new Promise((done) => {
    const next = () => (count-- > 0 ? requestAnimationFrame(next) : done());
    next();
  });

  // La photo d'un élément : on range la loupe le temps de la pose.
  const snap = async (node, name) => {
    let rect = node.getBoundingClientRect();
    const fits = rect.width <= innerWidth && rect.height <= innerHeight;
    if (fits && (rect.top < 0 || rect.left < 0 || rect.bottom > innerHeight || rect.right > innerWidth)) node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    host.style.setProperty('visibility', 'hidden', 'important');
    await frames(3);
    rect = node.getBoundingClientRect();
    const result = await send({ loupe: 'capture', rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, view: { width: innerWidth, height: innerHeight }, name });
    host.style.removeProperty('visibility');
    draw();
    told(result, fits ? '' : ' Seule la partie visible à l’écran est sur l’image.');
  };

  const blobToData = (blob) => new Promise((done, failed) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.onerror = failed;
    reader.readAsDataURL(blob);
  });

  // Second essai quand le serveur refuse le fond : relire le fichier depuis
  // la page elle-même, comme le site le fait.
  const throughPage = async (address, name) => {
    try {
      const response = await fetch(address, { credentials: 'include' });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size > 64 * 1024 ** 2) return null;
      const result = await send({ loupe: 'save', data: await blobToData(blob), name });
      return result.ok ? result : null;
    } catch {
      return null;
    }
  };

  const fetchFile = async (subject) => {
    const address = subject.larger || subject.url;
    const name = nameFor(address, subject.said);
    if (/^data:/i.test(address)) return told(await send({ loupe: 'save', data: address, name }));
    say('Téléchargement…');
    let result = web(address) ? await send({ loupe: 'download', url: address, name }) : null;
    if (!result?.ok) result = (await throughPage(address, name)) ?? result;
    // La grande version refusée : celle qui est affichée, au moins.
    if (!result?.ok && subject.larger && web(subject.url)) {
      const shown = await send({ loupe: 'download', url: subject.url, name: nameFor(subject.url, subject.said) });
      if (shown.ok) return told(shown, ' Le site a refusé la grande version : c’est celle affichée.');
    }
    if (result?.ok) return told(result, subject.larger ? ' C’est la plus grande version que le site propose.' : '');
    // Reste la photo de ce qui est affiché.
    const photo = element('button', '', 'Capturer en image');
    photo.addEventListener('click', () => snap(subject.node, name));
    say(result?.why ?? 'Le site a refusé d’envoyer le fichier.', true, subject.node ? photo : null);
  };

  // Un dessin SVG en fichier : sa copie, avec la couleur que la page lui donne
  // et les formes qu'il emprunte ailleurs dans la page.
  const drawingFile = (drawing) => {
    const copied = drawing.cloneNode(true);
    const rect = drawing.getBoundingClientRect();
    const style = getComputedStyle(drawing);
    copied.setAttribute('xmlns', SVG);
    copied.setAttribute('width', Math.round(rect.width));
    copied.setAttribute('height', Math.round(rect.height));
    copied.style.color = style.color;
    copied.style.fill = style.fill;
    copied.style.stroke = style.stroke;
    const borrowed = new Set();
    for (const use of copied.querySelectorAll('use')) {
      const id = (use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? '').replace(/^#/, '');
      const shape = id && !borrowed.has(id) && !copied.querySelector(`#${CSS.escape(id)}`) ? drawing.getRootNode().getElementById?.(id) : null;
      if (!shape) continue;
      borrowed.add(id);
      const defs = copied.querySelector('defs') ?? copied.insertBefore(document.createElementNS(SVG, 'defs'), copied.firstChild);
      defs.append(shape.cloneNode(true));
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copied))}`;
  };

  // Comment le bloc est dessiné : fond, arrondi, bord, ombre, marges.
  const lookRows = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const corners = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius];
    const widest = Math.max(...corners.map((corner) => parseFloat(corner) || 0));
    let rounding = '';
    if (widest > 0) {
      const same = corners.every((corner) => corner === corners[0]);
      const full = same && (corners[0].includes('%') ? parseFloat(corners[0]) >= 50 : widest >= Math.min(rect.width, rect.height) / 2);
      rounding = full ? 'Complet' : same ? pixels(corners[0]) : corners.map((corner) => number(parseFloat(corner), 1)).join(' · ') + ' px';
    }
    const edge = ['Top', 'Right', 'Bottom', 'Left'].find((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none');
    const border = edge ? { ...colorRow('Bordure', style[`border${edge}Color`]) } : { label: 'Bordure', value: '' };
    if (border.value) border.value = `${pixels(style[`border${edge}Width`])} · ${border.value}`;
    const pads = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map((pad) => parseFloat(pad) || 0);
    const padding = pads.some(Boolean) ? (pads.every((pad) => pad === pads[0]) ? pixels(pads[0]) : pads[0] === pads[2] && pads[1] === pads[3] ? `${number(pads[0], 1)} · ${number(pads[1], 1)} px` : `${pads.map((pad) => number(pad, 1)).join(' · ')} px`) : '';
    const fill = colorRow('Fond', style.backgroundColor);
    if (!fill.value && /gradient\(/.test(style.backgroundImage)) fill.value = 'Un dégradé';
    return [fill, { label: 'Arrondi', value: rounding }, border, { label: 'Ombre', value: style.boxShadow === 'none' ? '' : style.boxShadow, tall: true }, { label: 'Marges intérieures', value: padding }];
  };

  // La couleur de fond que l'on voit derrière l'élément : la sienne, sinon celle d'un parent.
  const backdrop = (node) => {
    for (let current = node; current; current = parentOf(current)) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== 'none') return { label: 'Fond', value: /url\(/.test(style.backgroundImage) ? 'Une image' : 'Un dégradé' };
      const row = colorRow('Fond', style.backgroundColor);
      if (row.value) return row;
    }
    return { label: 'Fond', value: '' };
  };

  // Ce que la page a mesuré en chargeant le fichier, quand le serveur le laisse lire.
  const seenBy = (address) => {
    const entry = performance.getEntriesByName(address, 'resource').at(-1);
    if (!entry) return { size: 0, type: '' };
    const open = entry.encodedBodySize > 0 || entry.transferSize > 0;
    const time = `${number(Math.max(1, entry.duration))} ms`;
    const cached = entry.deliveryType === 'cache' || (open && entry.transferSize === 0);
    return {
      size: entry.encodedBodySize || 0,
      type: entry.contentType ?? '',
      loaded: cached ? 'depuis le cache de Chrome' : open ? `depuis Internet, en ${time}` : '',
      protocol: PROTOCOLS[entry.nextHopProtocol] ?? '',
    };
  };

  const dataWeight = (address) => {
    const comma = address.indexOf(',');
    const body = address.slice(comma + 1);
    return /;base64$/i.test(address.slice(0, comma)) ? Math.floor((body.length * 3) / 4) : tidy(body).length;
  };

  // La fiche d'un fichier (image, vidéo, son, cadre) : son adresse, puis ce
  // que la page et le serveur en disent.
  const fileView = (subject, node, fresh, anchor = node) => {
    const { kind, url } = subject;
    subject.node = node;
    const view = { rows: [], more: [], actions: [] };
    const row = (label, value = '', extra) => {
      const entry = { label, value, ...extra };
      (extra?.more ? view.more : view.rows).push(entry);
      return entry;
    };
    const weight = row('Poids');
    const format = row('Format');
    const size = row('Taille', subject.width && subject.height ? `${sized(subject.width, subject.height)} px` : '');
    const time = row('Durée', Number.isFinite(subject.time) && subject.time > 0 ? lasting(subject.time) : '');
    const loaded = row('Chargement');
    const server = row('Serveur');
    const larger = row('Plus grande version', '', { more: true });
    const modified = row('Dernière modification', '', { more: true });
    const protocol = row('Protocole', '', { more: true });
    row('Description', subject.said?.trim() ? short(subject.said.trim(), 160) : '', { more: true });
    const software = row('Logiciel du serveur', '', { more: true });
    const capture = { text: 'Capturer en image', run: () => snap(node, nameFor('', subject.said)) };

    if (web(url)) {
      const { site: from, parts } = pieces(url);
      view.site = from;
      view.path = parts;
      const seen = seenBy(url);
      if (seen.size) weight.value = weigh(seen.size);
      format.value = formatOf(seen.type, url);
      loaded.value = seen.loaded ?? '';
      protocol.value = seen.protocol ?? '';
      row('Adresse', url, { more: true, tall: true });
      const copyAddress = { text: 'Copier l’adresse', run: () => copy(url, 'Adresse copiée.') };
      const openIt = { text: 'Ouvrir', run: () => window.open(url, '_blank', 'noopener') };
      // Le dossier où ce fichier est rangé, et ce que la page connaît autour.
      const explore = { text: 'Explorer', run: () => openFolder(folderOf(url), anchor) };
      if (kind === 'frame') {
        view.note = 'Un cadre : une autre page, affichée dans celle-ci.';
        view.actions = [{ ...capture, main: true }, copyAddress, openIt, explore];
      } else if (kind === 'other') {
        view.actions = [copyAddress, openIt, explore];
      } else {
        view.actions = [{ text: 'Télécharger', main: true, run: () => fetchFile(subject) }, copyAddress, openIt, explore];
      }
      // Le serveur complète : le poids exact, le format, l'hébergeur.
      if (kind !== 'frame') {
        send({ loupe: 'details', url }).then((answer) => {
          if (!fresh() || !answer.ok) return;
          if (answer.size && !seen.size) weight.value = weigh(answer.size);
          format.value = formatOf(answer.type, url) || format.value || answer.type;
          server.value = answer.host;
          software.value = answer.host ? '' : answer.software;
          if (answer.modified) modified.value = day(answer.modified);
          paint();
        });
        if (subject.larger) {
          larger.value = 'disponible';
          send({ loupe: 'details', url: subject.larger }).then((answer) => {
            if (!fresh() || !answer.ok || !answer.size) return;
            larger.value = weigh(answer.size);
            paint();
          });
        }
      }
    } else if (/^data:/i.test(url)) {
      view.site = 'Écrite dans la page';
      view.note = 'Pas de fichier à part : cette image est écrite dans le code de la page elle-même.';
      weight.value = weigh(dataWeight(url));
      format.value = formatOf(/^data:([^;,]+)/i.exec(url)?.[1], '');
      view.actions = [{ text: 'Télécharger', main: true, run: () => fetchFile(subject) }, capture];
    } else if (kind === 'image' && /^blob:/i.test(url)) {
      view.site = 'Fabriquée par la page';
      view.note = 'Le site a fabriqué cette image dans ton navigateur : elle n’a pas d’adresse sur Internet.';
      view.actions = [{ text: 'Télécharger', main: true, run: () => fetchFile(subject) }, capture];
    } else if (kind === 'video' || kind === 'audio') {
      // YouTube et les sites du même genre : dire d'abord que ce n'est pas une panne.
      const here = location.hostname.replace(/^www\./, '');
      view.site = 'Téléchargement impossible ici';
      view.note = `${here} n’envoie pas ${kind === 'video' ? 'cette vidéo' : 'ce son'} en un fichier, mais en centaines de petits morceaux à la suite : il n’y a aucune adresse à enregistrer.${kind === 'video' ? ' Loupe peut seulement prendre en photo l’image affichée.' : ''}`;
      view.actions = kind === 'video' ? [capture] : [];
    } else {
      view.site = kind === 'frame' ? 'Cadre fabriqué par la page' : 'Sans adresse';
      view.note = kind === 'frame' ? 'Ce cadre n’a pas d’adresse : la page écrit son contenu elle-même.' : '';
      view.actions = [{ ...capture, main: true }];
    }

    // Un dessin vectoriel n'a pas de taille à lui. Une image de fond ne dit pas
    // la sienne : on la relit (elle est déjà dans le cache).
    if (format.value === 'SVG') size.value = '';
    else if (kind === 'image' && !size.value && url) {
      const image = new Image();
      image.onload = () => {
        if (!fresh() || !image.naturalWidth) return;
        size.value = `${sized(image.naturalWidth, image.naturalHeight)} px`;
        paint();
      };
      image.src = url;
    }
    return view;
  };

  const madeView = (subject, node) => {
    const rect = node.getBoundingClientRect();
    const capture = { text: 'Capturer en image', run: () => snap(node, document.title) };
    if (subject.kind === 'canvas') {
      return {
        site: 'Dessiné par le site',
        note: 'Pas de fichier : le site dessine cette zone lui-même, image par image.',
        rows: [{ label: 'Taille', value: `${sized(subject.width, subject.height)} px` }],
        more: [],
        actions: [{ ...capture, main: true }],
      };
    }
    const file = drawingFile(node);
    const name = node.getAttribute('aria-label') || node.querySelector('title')?.textContent || 'dessin';
    return {
      site: 'Dessin écrit dans la page',
      note: 'Un dessin SVG : des formes décrites dans le code de la page, sans fichier à part.',
      rows: [
        { label: 'Poids', value: weigh(dataWeight(file)) },
        { label: 'Format', value: 'SVG' },
        { label: 'Taille', value: `${sized(rect.width, rect.height)} px` },
        colorRow('Couleur', getComputedStyle(node).color),
      ],
      more: [],
      actions: [{ text: 'Télécharger en SVG', main: true, run: async () => told(await send({ loupe: 'save', data: file, name })) }, capture],
    };
  };

  const textView = (subject, node) => {
    const style = getComputedStyle(node);
    const asked = families(style.fontFamily);
    const look = `${style.fontStyle === 'italic' ? 'italic' : 'normal'} ${style.fontWeight}`;
    const used = asked.find((family) => present(family, look)) ?? asked.at(-1) ?? '';
    // Les noms réservés aux Mac ne manquent à personne sur un PC : on n'en parle pas.
    const missing = asked.slice(0, asked.indexOf(used)).filter((family) => !/^(-|BlinkMacSystemFont$|system-ui$|ui-)/i.test(family));
    const words = textOf(node).replace(/\s+/g, ' ');
    const spacing = parseFloat(style.letterSpacing);
    const name = words.slice(0, 40).replace(/[\s,;:.!?…]+$/, '') || document.title;
    return {
      site: GENERIC[used.toLowerCase()] ?? used,
      path: words ? [`« ${short(words, 90)} »`] : [],
      note: missing.length ? `Le site demandait d’abord ${missing.map((family) => `« ${family} »`).join(', ')}, ${missing.length > 1 ? 'absentes' : 'absente'} de ton PC.` : '',
      rows: [
        { label: 'Taille', value: pixels(style.fontSize) },
        { label: 'Graisse', value: WEIGHTS[style.fontWeight] ? `${WEIGHTS[style.fontWeight]} · ${style.fontWeight}` : style.fontWeight },
        colorRow('Couleur', style.color),
        backdrop(node),
      ],
      more: [
        { label: 'Style', value: style.fontStyle === 'italic' ? 'Italique' : '' },
        { label: 'Interligne', value: style.lineHeight === 'normal' ? '' : pixels(style.lineHeight) },
        { label: 'Espacement des lettres', value: spacing ? pixels(spacing) : '' },
        { label: 'Polices demandées', value: asked.join(', '), tall: true },
        ...lookRows(node).slice(1),
      ],
      actions: [
        { text: 'Copier le texte', main: true, run: () => copy(textOf(node), 'Texte copié.') },
        { text: 'Enregistrer en .txt', run: async () => told(await send({ loupe: 'save', data: `data:text/plain;charset=utf-8,${encodeURIComponent(textOf(node))}`, name })) },
        { text: 'Capturer en image', run: () => snap(node, name) },
        { text: 'Données', run: () => openData(node, textOf(node)) },
      ],
    };
  };

  const blockView = (subject, node) => {
    const rect = node.getBoundingClientRect();
    const rows = lookRows(node);
    return {
      site: `${sized(rect.width, rect.height)} px`,
      note: rows.some((row) => row.value) ? '' : 'Ce bloc ne dessine rien lui-même : ni fond, ni bord. Essaie ↑ pour viser plus large.',
      rows,
      more: [],
      actions: [
        { text: 'Capturer en image', main: true, run: () => snap(node, node.getAttribute('aria-label') || document.title) },
        { text: 'Données', run: () => openData(node, (node.innerText ?? '').trim().split('\n')[0]) },
      ],
    };
  };

  const labelOf = (subject, node) => (subject.back ? 'Image de fond' : LABELS[subject.kind] ?? KINDS[node.localName] ?? 'Bloc');

  const rowOf = (entry) => {
    const line = element(entry.color || entry.go ? 'button' : 'div', entry.tall ? 'row tall' : entry.go ? 'row item' : 'row');
    const value = element('span', 'value');
    if (entry.go) line.addEventListener('click', entry.go);
    if (entry.color) {
      const dot = element('span', 'dot');
      dot.style.background = entry.paint;
      value.append(dot);
      line.title = 'Copier cette couleur';
      line.addEventListener('click', () => copy(entry.color, `Couleur ${entry.color} copiée.`));
    }
    value.append(entry.value);
    line.append(element('span', 'label', entry.label), value);
    return line;
  };

  // Écrit la fiche. Rappelée quand le serveur répond : seules les lignes qui
  // ont quelque chose à dire sont montrées.
  const paint = () => {
    if (!picked) return;
    const { view } = picked;
    const rows = view.rows.filter((entry) => entry.value);
    const more = view.more.filter((entry) => entry.value);
    const fold = element('button', view.open ? 'row fold open' : 'row fold');
    const arrow = element('span', 'value');
    arrow.append(icon('M4 6l4 4 4-4'));
    fold.append(element('span', 'label', view.open ? 'Moins' : 'Plus'), arrow);
    fold.setAttribute('aria-expanded', String(Boolean(view.open)));
    fold.addEventListener('click', () => {
      view.open = !view.open;
      paint();
    });
    list.replaceChildren(...rows.map(rowOf), ...(more.length ? [fold] : []), ...(view.open ? more.map(rowOf) : []));
    list.hidden = !rows.length && !more.length;
    place();
  };

  // La fiche se range à côté de l'élément : à droite, sinon à gauche, dessous,
  // dessus, et en dernier recours par-dessus, dans un coin.
  const place = () => {
    if (!picked || card.hidden) return;
    const rect = picked.node.getBoundingClientRect();
    const { width, height } = card.getBoundingClientRect();
    const gap = 10;
    const edge = 8;
    const within = (value, most) => Math.max(edge, Math.min(value, most));
    const maxLeft = innerWidth - edge - width;
    const maxTop = innerHeight - edge - height;
    let left = within(rect.left, maxLeft);
    let top = within(rect.top, maxTop);
    if (rect.right + gap <= maxLeft) left = rect.right + gap;
    else if (rect.left - gap - width >= edge) left = rect.left - gap - width;
    else if (rect.bottom + gap <= maxTop) top = rect.bottom + gap;
    else if (rect.top - gap - height >= edge) top = rect.top - gap - height;
    else [left, top] = [maxLeft - gap, maxTop - gap];
    card.style.left = `${Math.max(edge, left)}px`;
    card.style.top = `${Math.max(edge, top)}px`;
  };

  // Pose une fiche à côté de l'élément : celle de l'élément lui-même, d'un
  // dossier ou d'un fichier trouvé en explorant.
  const showCard = (node, view, label, size) => {
    picked = { node, view };
    chip.textContent = label;
    dims.textContent = size;
    site.textContent = view.site ?? '';
    path.replaceChildren(...(view.path ?? []));
    path.hidden = !view.path?.length;
    note.textContent = view.note ?? '';
    note.hidden = !view.note;
    actions.replaceChildren(
      ...view.actions.map((action) => {
        const button = element('button', action.main ? 'main' : '', action.text);
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await action.run();
          } catch {
            say('Loupe a rencontré une erreur sur cet élément.', true);
          }
          button.disabled = false;
        });
        return button;
      }),
    );
    actions.hidden = !view.actions.length;
    status.replaceChildren();
    card.hidden = false;
    card.scrollTop = 0;
    paint();
    draw();
  };

  const openCard = (node) => {
    const mine = ++ticket;
    const fresh = () => mine === ticket;
    const subject = subjectOf(node, pointer);
    const rect = node.getBoundingClientRect();
    const views = { image: fileView, video: fileView, audio: fileView, frame: fileView, canvas: madeView, drawing: madeView, text: textView };
    const view = (views[subject.kind] ?? blockView)(subject, node, fresh);
    showCard(node, view, labelOf(subject, node), subject.kind === 'block' ? '' : `${sized(rect.width, rect.height)} à l’écran`);
  };

  // ------------------------------------------------------------ explorateur

  const IMAGES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'tif', 'tiff']);
  const VIDEOS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov']);
  const SOUNDS = new Set(['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'weba']);
  const endOf = (url) => /\.([a-z0-9]{2,5})$/i.exec(url.pathname)?.[1].toLowerCase() ?? '';

  // Toutes les adresses que cette page connaît : ce qu'elle a chargé, ce
  // qu'elle affiche et ce vers quoi elle renvoie. Rien n'est deviné.
  const known = () => {
    const found = new Set();
    const add = (address) => {
      const full = address ? absolute(address).split('#')[0] : '';
      if (web(full) && found.size < 6000) found.add(full);
    };
    add(location.href);
    for (const entry of performance.getEntriesByType('resource')) add(entry.name);
    for (const node of document.querySelectorAll('img, video, audio, source, iframe, script[src], link[href], a[href]')) {
      add(node.currentSrc);
      add(node.getAttribute('src'));
      add(node.getAttribute('href'));
      for (const offer of offers(node.getAttribute('srcset') ?? '')) add(offer.url);
    }
    return found;
  };

  const folderOf = (address) => new URL('.', address).href;
  const crumb = (text, go) => {
    const button = element('button', '', text);
    button.addEventListener('click', go);
    return button;
  };

  // La fiche d'un fichier trouvé en explorant : il n'est pas forcément affiché sur la page.
  const openFile = (address, anchor) => {
    const mine = ++ticket;
    const end = endOf(new URL(address));
    const kind = IMAGES.has(end) ? 'image' : VIDEOS.has(end) ? 'video' : SOUNDS.has(end) ? 'audio' : 'other';
    const view = fileView({ kind, url: address, said: '' }, null, () => mine === ticket, anchor);
    showCard(anchor, view, LABELS[kind] ?? 'Fichier', '');
  };

  // Le premier étage : les serveurs avec lesquels la page échange.
  const openHosts = (anchor) => {
    ticket++;
    const counts = new Map();
    for (const address of known()) {
      const { origin } = new URL(address);
      counts.set(origin, (counts.get(origin) ?? 0) + 1);
    }
    const rows = [...counts]
      .sort((first, second) => second[1] - first[1])
      .map(([origin, count]) => ({ label: new URL(origin).host, value: number(count), go: () => openFolder(`${origin}/`, anchor) }));
    showCard(anchor, { site: 'Serveurs de cette page', path: [], note: 'Tous les sites avec lesquels cette page échange des fichiers ou vers lesquels elle renvoie.', rows, more: [], actions: [] }, 'Explorateur', `${number(rows.length)} serveurs`);
  };

  // Un dossier : ce que la page en connaît, puis ce que le serveur veut bien
  // en montrer s'il publie sa liste. Une seule question, à l'ouverture.
  const openFolder = (address, anchor) => {
    const mine = ++ticket;
    const base = new URL(address);
    const folders = new Map(); // nom → nombre d'adresses dessous
    const files = new Map(); // adresse → nom
    const take = (full) => {
      const url = new URL(full);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.href === base.href) return;
      const [first, ...rest] = url.pathname.slice(base.pathname.length).split('/');
      if (rest.length) folders.set(first, (folders.get(first) ?? 0) + 1);
      else if (first) files.set(url.href, tidy(first) + (url.search ? `  ${short(url.search, 18)}` : ''));
    };
    for (const full of known()) take(full);

    const steps = base.pathname.split('/').filter(Boolean);
    const parts = [crumb('Serveurs', () => openHosts(anchor)), ' › ', crumb(base.hostname, () => openFolder(`${base.origin}/`, anchor))];
    steps.forEach((step, index) => {
      const target = `${base.origin}/${steps.slice(0, index + 1).join('/')}/`;
      parts.push(' › ', index === steps.length - 1 ? element('b', '', short(tidy(step), 28)) : crumb(short(tidy(step), 28), () => openFolder(target, anchor)));
    });

    const view = { site: steps.length ? tidy(steps.at(-1)) : base.hostname, path: parts, note: 'Je demande au serveur ce que contient ce dossier…', rows: [], more: [], actions: [] };
    const list = () => {
      const most = 300;
      const rows = [
        ...[...folders].sort(([first], [second]) => first.localeCompare(second, 'fr')).map(([name, count]) => ({ label: `${short(tidy(name), 34)} /`, value: count ? number(count) : '›', go: () => openFolder(`${base.href}${name}/`, anchor) })),
        ...[...files].sort((first, second) => first[1].localeCompare(second[1], 'fr')).map(([full, name]) => ({ label: name, value: FORMATS[endOf(new URL(full))] ?? (endOf(new URL(full)).toUpperCase() || 'page'), go: () => openFile(full, anchor) })),
      ];
      view.rows = rows.length > most ? [...rows.slice(0, most), { label: `… et ${number(rows.length - most)} autres`, value: ' ' }] : rows;
      dims.textContent = `${number(folders.size)} dossier${folders.size > 1 ? 's' : ''} · ${number(files.size)} fichier${files.size > 1 ? 's' : ''}`;
    };
    list();
    showCard(anchor, view, 'Dossier', dims.textContent);
    list();

    send({ loupe: 'folder', url: base.href }).then((answer) => {
      if (mine !== ticket) return;
      if (answer.listed) {
        for (const entry of answer.entries) {
          if (entry.folder) folders.set(entry.name, folders.get(entry.name) ?? 0);
          else take(entry.url);
        }
        view.note = 'Le serveur publie la liste de ce dossier : tout ce qu’il contient est ici.';
      } else {
        view.note = `Le serveur ne montre pas le contenu de ce dossier${answer.status ? ` (réponse ${answer.status})` : ''}. Voici seulement ce que cette page en connaît.`;
      }
      note.textContent = view.note;
      list();
      paint();
    });
  };

  // ---------------------------------------------------------------- données

  // Les adresses que la page a interrogées pour remplir son contenu (ce que
  // F12 range sous « Fetch/XHR »), de la plus récente à la plus ancienne.
  const dataAddresses = () => {
    const found = new Set();
    for (const entry of performance.getEntriesByType('resource').reverse()) {
      if (['fetch', 'xmlhttprequest'].includes(entry.initiatorType) && web(entry.name)) found.add(entry.name.split('#')[0]);
      if (found.size >= 40) break;
    }
    return [...found];
  };

  const plain = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

  // Où le texte cherché se trouve dans une réponse : son chemin dans des
  // données rangées (JSON), « texte » dans une page, rien s'il n'y est pas.
  const whereIn = (body, needle) => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      // pas des données rangées : une page, dont on lit le texte sans rien exécuter
      const page = new DOMParser().parseFromString(body, 'text/html');
      return plain(page.documentElement?.textContent ?? body).includes(needle) ? 'texte' : null;
    }
    const walk = (value, trail, depth) => {
      if (typeof value === 'string') return plain(value).includes(needle) ? trail : null;
      if (!value || typeof value !== 'object' || depth > 12) return null;
      for (const [key, inner] of Object.entries(value)) {
        const hit = walk(inner, [...trail, key], depth + 1);
        if (hit) return hit;
      }
      return null;
    };
    const hit = walk(data, [], 0);
    return hit ? hit.join(' › ') || 'texte' : null;
  };

  // D'où vient un texte : la liste des adresses de données de la page, et une
  // recherche qui les relit, comme la page l'a fait, pour dire laquelle le contient.
  const openData = (anchor, words) => {
    const mine = ++ticket;
    const here = location.href.split('#')[0];
    const said = words.replace(/\s+/g, ' ').trim();
    const needle = plain(said).slice(0, 60);
    const entries = [
      { address: here, label: 'La page elle-même' },
      ...dataAddresses()
        .filter((address) => address !== here)
        .map((address) => {
          const url = new URL(address);
          return { address, label: `${url.origin === location.origin ? '' : url.hostname}${short(tidy(url.pathname), 38)}${url.search ? ' ?…' : ''}` };
        }),
    ];
    const count = entries.length - 1;
    const view = {
      site: 'Données de la page',
      path: needle.length >= 3 ? [`« ${short(said, 70)} »`] : [],
      note: count
        ? `Depuis son chargement, la page a interrogé ${number(count)} adresse${count > 1 ? 's' : ''} pour remplir son contenu. La base de données reste derrière le serveur : on ne voit que ces adresses et leurs réponses.`
        : 'Depuis son chargement, la page n’a interrogé aucune adresse de données : son contenu est sans doute écrit dans la page elle-même.',
      rows: [],
      more: [],
      actions: [],
    };
    const list = () => {
      view.rows = [...entries].sort((first, second) => Boolean(second.hit) - Boolean(first.hit)).map((entry) => ({ label: entry.label, value: entry.state ?? '›', go: () => openFile(entry.address, anchor) }));
    };

    const search = async () => {
      say('Je relis ces adresses…');
      const queue = [...entries];
      const read = async () => {
        for (let entry; (entry = queue.shift()); ) {
          try {
            const response = await fetch(entry.address, { credentials: 'include', signal: AbortSignal.timeout(7000) });
            if (!response.ok) throw new Error('refus');
            entry.body = (await response.text()).slice(0, 3000000);
          } catch {
            entry.state = 'illisible';
          }
        }
      };
      await Promise.all([read(), read(), read(), read()]);
      if (mine !== ticket) return;
      // le début du texte, puis un début plus court si la page l'a recomposé
      for (const size of [needle.length, 24]) {
        for (const entry of entries) {
          if (entry.body === undefined) continue;
          entry.hit = whereIn(entry.body, needle.slice(0, size));
          entry.state = entry.hit ? `✓ ${short(entry.hit, 26)}` : '—';
        }
        if (entries.some((entry) => entry.hit) || needle.length <= 24) break;
      }
      const unread = entries.filter((entry) => entry.body === undefined).length;
      for (const entry of entries) delete entry.body;
      list();
      paint();
      const hits = entries.filter((entry) => entry.hit);
      const also = unread ? ` ${number(unread)} adresse${unread > 1 ? 's n’ont' : ' n’a'} pas pu être relue${unread > 1 ? 's' : ''}.` : '';
      if (!hits.length) return say(`Introuvable dans ce que Loupe peut relire. Ce texte vient peut-être d’un envoi que Loupe ne peut pas rejouer, ou la page le fabrique elle-même.${also}`, true);
      if (hits.every((entry) => entry.address === here)) return say(`Ce texte est écrit dans la page elle-même : il ne vient pas d’une demande à part.${also}`);
      say(`Trouvé : en tête de liste, avec l’endroit où il est rangé dans la réponse.${also}`);
    };

    if (needle.length >= 3) view.actions = [{ text: 'Chercher mon texte', main: true, run: search }];
    list();
    showCard(anchor, view, 'Données', `${number(count)} adresse${count > 1 ? 's' : ''}`);
  };

  const closeCard = () => {
    ticket++;
    picked = null;
    card.hidden = true;
    draw();
  };

  // ------------------------------------------------------------------ visée

  const setFrame = (frame, rect) => {
    frame.style.left = `${rect.left}px`;
    frame.style.top = `${rect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
  };

  const draw = () => {
    kept.hidden = !picked;
    if (picked) setFrame(kept, picked.node.getBoundingClientRect());
    place();
    box.hidden = tag.hidden = !target || target === picked?.node;
    if (box.hidden) return;
    const rect = target.getBoundingClientRect();
    setFrame(box, rect);
    tag.textContent = `${labelOf(subjectOf(target, pointer), target)} · ${sized(rect.width, rect.height)}`;
    tag.style.left = `${Math.max(4, Math.min(rect.left, innerWidth - tag.offsetWidth - 4))}px`;
    tag.style.top = `${rect.top >= 26 ? rect.top - 24 : Math.min(rect.bottom + 4, innerHeight - 24)}px`;
  };

  // Vu de la page, la vitre, la barre et la fiche sont le même élément : on
  // les départage par la position. Un clic sans souris vient du clavier, donc d'un bouton.
  const onUi = (event) => {
    if (event.target !== host) return false;
    if (event.type === 'click' && event.detail === 0) return true;
    return [bar, card].some((part) => {
      if (part.hidden) return false;
      const rect = part.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  };
  const swallow = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  let moved = null; // dernier mouvement de souris reçu, pas encore traité
  let frame = 0;
  const aim = () => {
    frame = 0;
    if (moved) pointer = onUi(moved) ? null : { x: moved.clientX, y: moved.clientY };
    moved = null;
    const node = pointer ? pickAt(pointer.x, pointer.y) : null;
    // Même élément sous la souris : on garde l'élargissement choisi avec ↑ ↓.
    if (node !== (trail[0] ?? null)) {
      trail = [];
      for (let current = node; current && current !== document.documentElement; current = parentOf(current)) {
        if (current === node || (current !== document.body && current.getClientRects().length)) trail.push(current);
      }
      depth = 0;
    }
    target = trail[depth] ?? null;
    draw();
  };

  // Une souris envoie bien plus de mouvements que l'écran n'affiche d'images :
  // on vise une fois par image, pas une fois par mouvement.
  const aimSoon = () => {
    frame ||= requestAnimationFrame(aim);
  };
  // Avant d'agir (clic, flèche) : viser tout de suite si un mouvement attend.
  const settle = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    aim();
  };

  // Seuls les gestes de la vraie souris et du vrai clavier comptent : une page
  // ne doit pas pouvoir ouvrir une fiche ni lancer un téléchargement en imitant un clic.
  const onMove = (event) => {
    if (!event.isTrusted) return;
    moved = event;
    aimSoon();
  };

  // La vitre arrête la molette : la page défile quand même d'elle-même, mais
  // pas une liste qui a son propre défilement. On la fait défiler à la main.
  const onWheel = (event) => {
    if (event.ctrlKey || onUi(event)) return;
    const scale = event.deltaMode === 1 ? 40 : 1;
    const below = document.elementsFromPoint(event.clientX, event.clientY).find((found) => found !== host);
    for (let node = below; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (!/auto|scroll|overlay/.test(style.overflowX + style.overflowY)) continue;
      const [left, top] = [node.scrollLeft, node.scrollTop];
      node.scrollBy({ left: event.deltaX * scale, top: event.deltaY * scale, behavior: 'instant' });
      if (node.scrollLeft !== left || node.scrollTop !== top) {
        event.preventDefault();
        return;
      }
    }
  };

  const onClick = (event) => {
    if (!event.isTrusted || onUi(event)) return;
    swallow(event);
    settle();
    if (target) openCard(target);
  };

  // La page ne doit pas réagir aux clics tant que la loupe est en main.
  const onPress = (event) => {
    if (!onUi(event)) swallow(event);
  };

  const onKey = (event) => {
    if (!event.isTrusted) return;
    settle();
    if (event.key === 'Escape') stop();
    else if (event.key === 'ArrowUp' && depth < trail.length - 1) target = trail[++depth];
    else if (event.key === 'ArrowDown' && depth > 0) target = trail[--depth];
    else return;
    swallow(event);
    draw();
  };

  const PRESSES = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'dblclick', 'contextmenu'];
  const stop = () => {
    ticket++;
    removeEventListener('mousemove', onMove, true);
    removeEventListener('click', onClick, true);
    removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', aimSoon, true);
    cancelAnimationFrame(frame);
    removeEventListener('wheel', onWheel, { capture: true });
    removeEventListener('resize', draw, true);
    for (const type of PRESSES) removeEventListener(type, onPress, true);
    host.remove();
    delete globalThis.loupeStop;
  };
  globalThis.loupeStop = stop;

  sideButton.addEventListener('click', () => bar.classList.toggle('low'));
  doneButton.addEventListener('click', stop);
  closeButton.addEventListener('click', closeCard);

  addEventListener('mousemove', onMove, true);
  addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);
  // Après un défilement, ce n'est plus le même élément sous la souris.
  addEventListener('scroll', aimSoon, true);
  addEventListener('wheel', onWheel, { capture: true, passive: false });
  addEventListener('resize', draw, true);
  for (const type of PRESSES) addEventListener(type, onPress, true);

  document.documentElement.append(host);
  // Couche supérieure du navigateur : au-dessus des fenêtres modales de la page.
  try {
    host.popover = 'manual';
    host.showPopover();
  } catch {
    // popover indisponible : le z-index suffit
  }
  draw();
})();
