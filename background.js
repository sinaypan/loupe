// Le fond de Loupe. Trois gestes que la loupe (picker.js) ne peut pas faire
// depuis la page : lire ce que le serveur dit d'un fichier venu d'un autre
// site, enregistrer un fichier dans Téléchargements, photographier l'onglet.
// Rien ne tourne tant que la loupe ne demande rien.

// Textes dans la langue de Chrome (_locales).
const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String)) || key;

const FOLDER = 'Loupe';

// Les seuls genres de fichiers que Loupe enregistre, et l'extension donnée à
// chacun : un fichier enregistré porte toujours l'une d'elles, jamais celle
// d'un programme.
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/apng': 'png',
  'image/tiff': 'tif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'weba',
  'audio/flac': 'flac',
  'text/plain': 'txt',
};
const EXTENSIONS = new Set([...Object.values(TYPES), 'jpeg', 'tiff', 'm4v', 'oga', 'opus']);

// Qui héberge le fichier, d'après ce que le serveur laisse voir de lui.
const HOSTS = [
  ['Wikimedia', (h, host) => /(^|\.)(wikimedia|wikipedia)\.org$/.test(host)],
  ['Cloudflare', (h) => h.has('cf-ray') || /cloudflare/i.test(h.get('server') ?? '')],
  ['Amazon CloudFront', (h) => h.has('x-amz-cf-id')],
  ['Amazon S3', (h) => /amazons3/i.test(h.get('server') ?? '') || h.has('x-amz-request-id')],
  ['Fastly', (h) => h.has('x-fastly-request-id') || /^cache-/.test(h.get('x-served-by') ?? '')],
  ['Akamai', (h) => /akamai/i.test(h.get('server') ?? '') || h.has('x-akamai-transformed')],
  ['Google', (h) => /^(gws|sffe|gse|esf|uploadserver|google frontend|gvs)/i.test(h.get('server') ?? '') || h.has('x-guploader-uploadid')],
  ['Microsoft Azure', (h) => h.has('x-azure-ref') || h.has('x-msedge-ref') || h.has('x-ms-request-id')],
  ['Vercel', (h) => h.has('x-vercel-id')],
  ['Netlify', (h) => h.has('x-nf-request-id')],
  ['GitHub', (h) => h.has('x-github-request-id')],
  ['Bunny', (h) => /bunnycdn/i.test(h.get('server') ?? '')],
];

const fail = (why) => ({ ok: false, why });
const sleep = (time) => new Promise((done) => setTimeout(done, time));

// Une adresse de la machine ou du réseau de la maison (box, imprimante).
const PRIVATE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|\[)|\.(local|localhost|lan|home|internal)$/;

// L'adresse vient de la page, donc de quelqu'un d'autre : seulement du web, et
// jamais un appareil du réseau de la maison, sauf si la page en est un elle-même.
const outside = (address, tab) => {
  try {
    const url = new URL(address);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (PRIVATE.test(url.hostname) && url.hostname !== new URL(tab.url).hostname) return null;
    return url;
  } catch {
    return null;
  }
};

const typeOf = (headers) => (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

// Ce que le serveur dit du fichier, sans le télécharger : on ne demande que
// ses en-têtes, sans cookies, donc sans rien dire de qui demande.
const ask = async (url) => {
  const options = { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
  let response = await fetch(url, { ...options, method: 'HEAD', signal: AbortSignal.timeout(6000) });
  let size = Number(response.headers.get('content-length')) || 0;
  if (!response.ok || !size) {
    // Certains serveurs refusent cette question ou n'y disent pas le poids :
    // on demande alors le premier octet du fichier, et on coupe aussitôt.
    const cut = new AbortController();
    const timer = setTimeout(() => cut.abort(), 6000);
    try {
      const first = await fetch(url, { ...options, headers: { Range: 'bytes=0-0' }, signal: cut.signal });
      const total = Number((first.headers.get('content-range') ?? '').split('/')[1]);
      const whole = first.status === 200 ? Number(first.headers.get('content-length')) : 0;
      if (first.ok) {
        response = first;
        size = total || whole || 0;
      }
    } catch {
      // pas de réponse à la seconde question : on garde la première
    } finally {
      clearTimeout(timer);
      cut.abort();
    }
  }
  const headers = response.headers;
  const modified = Date.parse(headers.get('last-modified') ?? '');
  return {
    ok: response.ok,
    status: response.status,
    type: typeOf(headers),
    size,
    modified: Number.isFinite(modified) ? modified : 0,
    host: HOSTS.find(([, test]) => test(headers, url.hostname))?.[0] ?? '',
    software: (headers.get('server') ?? '').slice(0, 60),
  };
};

const details = async ({ url: address }, tab) => {
  const url = outside(address, tab);
  if (!url) return fail(t('outsideWeb'));
  try {
    return await ask(url);
  } catch {
    return fail(t('noAnswer'));
  }
};

// Le nom du fichier enregistré : sans rien que Windows refuse, et sans
// extension, le fond pose la sienne.
const clean = (name) => {
  let text = String(name ?? '').normalize('NFC');
  const dot = text.lastIndexOf('.');
  if (dot > 0 && EXTENSIONS.has(text.slice(dot + 1).toLowerCase())) text = text.slice(0, dot);
  text = text
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, 80)
    .trim();
  return text || 'fichier';
};

const extensionIn = (url) => {
  const found = /\.([a-z0-9]{2,5})$/i.exec(url.pathname)?.[1].toLowerCase();
  return found && EXTENSIONS.has(found) ? found : '';
};

// Lance l'enregistrement et regarde s'il part bien : un serveur peut refuser,
// ou envoyer une page d'erreur à la place du fichier.
const store = async (source, name, extension) => {
  let id;
  try {
    id = await chrome.downloads.download({ url: source, filename: `${FOLDER}/${clean(name)}.${extension}`, conflictAction: 'uniquify', saveAs: false });
  } catch {
    return fail(t('chromeRefusedSave'));
  }
  for (const wait of [250, 500, 1000]) {
    await sleep(wait);
    const [item] = await chrome.downloads.search({ id });
    const page = item && /^(text\/html|application\/json)/.test(item.mime) && extension !== 'txt';
    if (!item || item.state === 'interrupted' || page) {
      if (item?.state === 'in_progress') await chrome.downloads.cancel(id).catch(() => {});
      if (page && item.state === 'complete') await chrome.downloads.removeFile(id).catch(() => {});
      await chrome.downloads.erase({ id }).catch(() => {});
      return fail(t('siteRefused'));
    }
    if (item.state === 'complete') return { ok: true, id, done: true };
  }
  return { ok: true, id, done: false }; // un gros fichier, encore en route
};

const download = async ({ url: address, name }, tab) => {
  const url = outside(address, tab);
  if (!url) return fail(t('outsideWeb'));
  const told = await ask(url).catch(() => null);
  // Le serveur dit ce qu'est le fichier ; s'il ne dit rien de précis, la fin de l'adresse.
  const vague = !told?.type || /octet-stream$/.test(told.type);
  const extension = TYPES[told?.type] ?? (vague ? extensionIn(url) : '');
  if (!extension) return fail(t('notMedia'));
  return store(url.href, name, extension);
};

// Un fichier que la loupe a fabriqué dans la page : un dessin SVG, un texte,
// une image que seule la page pouvait relire.
const save = async ({ data, name }) => {
  const type = /^data:([a-z0-9.+/-]+)[;,]/i.exec(String(data).slice(0, 80))?.[1].toLowerCase();
  const extension = TYPES[type];
  if (!extension) return fail(t('notMedia'));
  return store(data, name, extension);
};

const toDataUrl = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return `data:${blob.type};base64,${btoa(text)}`;
};

// La photo d'un bloc : celle de l'onglet affiché, recoupée au cadre du bloc.
const capture = async ({ rect, view, name }, tab) => {
  if (!tab.active) return fail(t('tabHidden'));
  let shot;
  try {
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    return fail(t('noPhoto'));
  }
  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const scale = bitmap.width / Math.max(1, Number(view?.width) || bitmap.width);
  const within = (value, most) => Math.min(Math.max(0, Math.round(Number(value) * scale) || 0), most);
  const left = within(rect?.left, bitmap.width);
  const top = within(rect?.top, bitmap.height);
  const width = within(rect?.right, bitmap.width) - left;
  const height = within(rect?.bottom, bitmap.height) - top;
  if (width < 1 || height < 1) return fail(t('notVisible'));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bitmap, left, top, width, height, 0, 0, width, height);
  bitmap.close();
  return store(await toDataUrl(await canvas.convertToBlob({ type: 'image/png' })), name, 'png');
};

// Ouvre le dossier sur le fichier, s'il vient bien de Loupe.
const show = async ({ id }) => {
  const [item] = Number.isInteger(id) ? await chrome.downloads.search({ id }) : [];
  if (item?.byExtensionId !== chrome.runtime.id) return fail(t('fileMissing'));
  chrome.downloads.show(id);
  return { ok: true };
};

// Le contenu d'un dossier, quand le serveur publie lui-même sa liste (une page
// « Index of »). On la lit telle quelle : aucun nom de fichier n'est deviné.
const folder = async ({ url: address }, tab) => {
  const url = outside(address, tab);
  if (!url || !url.pathname.endsWith('/')) return fail(t('outsideWeb'));
  let response;
  try {
    response = await fetch(url, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
  } catch {
    return { ok: true, listed: false };
  }
  if (!response.ok || typeOf(response.headers) !== 'text/html') return { ok: true, listed: false, status: response.ok ? 0 : response.status };
  const text = (await response.text()).slice(0, 600000);
  if (!/<(title|h1)>\s*(Index of|Directory listing for)/i.test(text)) return { ok: true, listed: false };
  const entries = new Map();
  for (const [, link] of text.matchAll(/<a\s[^>]*href="([^"?#][^"]*)"/gi)) {
    let found;
    try {
      found = new URL(link.replaceAll('&amp;', '&'), url);
    } catch {
      continue;
    }
    // seulement ce qui est rangé juste dans ce dossier
    if (found.origin !== url.origin || !found.pathname.startsWith(url.pathname)) continue;
    const [name, ...deeper] = found.pathname.slice(url.pathname.length).split('/');
    if (!name || deeper.length > 1 || (deeper.length === 1 && deeper[0])) continue;
    entries.set(name, { name, url: found.href, folder: deeper.length === 1 });
    if (entries.size >= 1000) break;
  }
  return { ok: true, listed: true, entries: [...entries.values()] };
};

const JOBS = { details, download, save, capture, show, folder };

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  // Seule la loupe posée dans un onglet parle au fond : ni une page, ni une autre extension.
  if (sender.id !== chrome.runtime.id || !sender.tab || !Object.hasOwn(JOBS, message?.loupe)) return;
  JOBS[message.loupe](message, sender.tab).then(reply, () => reply(fail(t('loupeError'))));
  return true;
});

// Le raccourci clavier donne la loupe sans passer par la bulle de l'icône.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'aim' || !tab?.id) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] }).catch(() => {
    // page où Chrome n'autorise aucun script (nouvel onglet, chrome://...)
  });
});
