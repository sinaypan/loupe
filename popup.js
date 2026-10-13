const byId = (id) => document.getElementById(id);
const aim = byId('aim');
const hint = byId('hint');

let tab = null;

// Chrome protège ses propres pages, sa boutique et les fichiers ouverts depuis le PC.
const refuse = () => {
  aim.disabled = true;
  hint.textContent = 'Chrome ne permet pas d’inspecter cette page. Essaie sur un site.';
};

aim.addEventListener('click', async () => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
    window.close();
  } catch {
    refuse();
  }
});

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [command] = (await chrome.commands.getAll()).filter((entry) => entry.name === 'aim');
  byId('key').textContent = command?.shortcut ?? '';
  let url = null;
  try {
    url = new URL(tab.url);
  } catch {
    // adresse illisible : page protégée
  }
  if (!url || !/^https?:$/.test(url.protocol)) {
    byId('site').textContent = 'Loupe';
    refuse();
    return;
  }
  byId('site').textContent = url.hostname.replace(/^www\./, '');
  hint.textContent = 'Clique ensuite sur une image, une vidéo, un texte ou un bloc de la page pour ouvrir sa fiche.';
})();
