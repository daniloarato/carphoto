const $ = (id) => document.getElementById(id);
const form = $('edit-form');
const fileInput = $('file-input');
const cameraInput = $('camera-input');
let selectedFile;
let sourceUrl;
let resultUrl;
let busy = false;
let available = false;
let selectionVersion = 0;
let selectedUpload;

function feedback(message, type = '') {
  $('feedback').textContent = message;
  $('feedback').className = `feedback ${type}`;
  $('feedback').hidden = !message;
}

function updateControls() {
  $('generate-button').disabled = busy || !selectedFile || !available;
  for (const input of document.querySelectorAll('input[name="preset"]')) input.disabled = busy;
  for (const id of ['upload-button', 'camera-button', 'replace-button', 'file-input', 'camera-input']) $(id).disabled = busy;
  $('generate-label').textContent = busy ? 'CRIANDO SUA NOVA CENA…' : 'GERAR MINHA FOTO';
  form.setAttribute('aria-busy', String(busy));
}

function clearResult() {
  $('result').hidden = true;
  $('result-image').removeAttribute('src');
  $('before-image').removeAttribute('src');
  $('download').removeAttribute('href');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = undefined;
}

async function selectFile(file) {
  if (!file || busy) return;
  const version = ++selectionVersion;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return feedback('Escolha uma foto em JPG, PNG ou WebP. Se estiver em HEIC, converta para JPG primeiro.', 'error');
  if (file.size > 15 * 1024 * 1024) return feedback('Sua foto deve ter no máximo 15 MB. Escolha uma versão menor.', 'error');
  const url = URL.createObjectURL(file);
  const candidate = new Image();
  candidate.src = url;
  try {
    await candidate.decode();
    if (candidate.naturalWidth * candidate.naturalHeight > 40_000_000) throw new Error('pixels');
  } catch {
    URL.revokeObjectURL(url);
    if (version === selectionVersion) feedback('Não conseguimos abrir esta foto. Use uma imagem válida de até 40 megapixels.', 'error');
    return;
  }
  if (version !== selectionVersion || busy) { URL.revokeObjectURL(url); return; }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2048 / Math.max(candidate.naturalWidth, candidate.naturalHeight));
  canvas.width = Math.round(candidate.naturalWidth * scale);
  canvas.height = Math.round(candidate.naturalHeight * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#181818';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(candidate, 0, 0, canvas.width, canvas.height);
  const upload = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (version !== selectionVersion || busy || !upload) { URL.revokeObjectURL(url); return; }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = url;
  selectedFile = file;
  selectedUpload = upload;
  $('source-image').src = sourceUrl;
  $('file-name').textContent = file.name;
  $('empty-state').hidden = true;
  $('photo-state').hidden = false;
  clearResult();
  feedback('Foto selecionada. Escolha uma perspectiva para continuar.');
  updateControls();
}

$('upload-button').addEventListener('click', () => fileInput.click());
$('replace-button').addEventListener('click', () => fileInput.click());
$('camera-button').addEventListener('click', () => cameraInput.click());
for (const input of [fileInput, cameraInput]) input.addEventListener('change', () => {
  selectFile(input.files[0]);
  input.value = '';
});
const zone = $('dropzone');
for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, (event) => { event.preventDefault(); if (!busy) zone.classList.add('dragging'); });
for (const type of ['dragleave', 'drop']) zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove('dragging'); });
zone.addEventListener('drop', (event) => {
  if (event.dataTransfer.files.length > 1) return feedback('Escolha uma foto por vez.', 'error');
  selectFile(event.dataTransfer.files[0]);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile || busy || !available) return;
  const preset = new FormData(form).get('preset');
  const body = new FormData();
  body.set('preset', preset);
  body.set('image', selectedUpload, 'car.jpg');
  busy = true;
  updateControls();
  clearResult();
  feedback('Estamos criando sua nova perspectiva. Isso pode levar até 3 minutos. Mantenha esta página aberta.', 'loading');
  try {
    const response = await fetch('/api/edit', { method: 'POST', body, signal: AbortSignal.timeout(195_000) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Não foi possível gerar a foto. Tente novamente.');
    }
    if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('O serviço retornou uma resposta inesperada. Tente novamente.');
    resultUrl = URL.createObjectURL(await response.blob());
    $('result-image').src = resultUrl;
    await $('result-image').decode();
    $('before-image').src = sourceUrl;
    $('result-caption').textContent = `CARPHOTO / ${preset.toUpperCase()}`;
    $('download').href = resultUrl;
    $('download').download = `carphoto-${preset}.png`;
    $('result').hidden = false;
    feedback('Sua foto está pronta. Compare o resultado e baixe a imagem.');
    $('result-title').focus({ preventScroll: true });
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    clearResult();
    const message = error.name === 'TimeoutError' ? 'A edição demorou mais que o esperado. Tente novamente em alguns instantes.' : error instanceof TypeError ? 'Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.' : error.message;
    feedback(message || 'Não foi possível abrir a imagem gerada. Tente novamente.', 'error');
  } finally {
    busy = false;
    updateControls();
  }
});

async function checkAvailability() {
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw new Error('health');
    const data = await response.json();
    available = data.generationConfigured === true;
    $('availability').textContent = available ? '' : 'A geração ainda está sendo preparada. Você já pode selecionar sua foto e explorar os estilos.';
  } catch {
    available = false;
    $('availability').textContent = 'Não foi possível conectar ao estúdio. Vamos tentar novamente em instantes.';
  }
  $('availability').hidden = available;
  updateControls();
}
checkAvailability();
setInterval(() => { if (!busy && !available) checkAvailability(); }, 30_000);
