import express from 'express';
import multer from 'multer';
import { normalizeImage } from './image.js';
import { fileURLToPath } from 'node:url';
import { presets } from './presets.js';
import { createImageEditor, ImageServiceError } from './openai.js';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
const maxBytes = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1, fields: 1, parts: 2, fieldSize: 100 },
}).single('image');

export function createApp({ apiKey = process.env.CARPHOTO_API_KEY || process.env.OPENAI_API_KEY, editImage, model = process.env.CARPHOTO_IMAGE_MODEL || 'gpt-image-1.5' } = {}) {
  const app = express();
  const configured = Boolean(apiKey || editImage);
  const edit = editImage || createImageEditor({ apiKey, model });
  let active = false;
  const recent = [];
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    });
    next();
  });
  app.get('/api/health', (_req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, generationConfigured: configured }));
  app.post('/api/edit', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Solicitação não permitida.' });
    if (req.get('origin')) {
      try {
        if (new URL(req.get('origin')).host !== req.get('host')) return res.status(403).json({ error: 'Solicitação não permitida.' });
      } catch { return res.status(403).json({ error: 'Solicitação não permitida.' }); }
    }
    if (!configured) return res.status(503).json({ error: 'A geração ainda não está configurada. Você já pode escolher sua foto e estilo.' });
    const now = Date.now();
    while (recent.length && now - recent[0] > 60_000) recent.shift();
    if (active || recent.length >= 5) return res.status(429).json({ error: 'Aguarde um momento antes de gerar outra foto.' });
    active = true;
    recent.push(now);
    let released = false;
    const release = () => { if (!released) { active = false; released = true; } };
    res.once('finish', release);
    res.once('close', release);
    next();
  }, upload, async (req, res, next) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    try {
      const preset = Object.hasOwn(presets, req.body?.preset ?? '') ? presets[req.body.preset] : null;
      if (!preset) throw new ImageServiceError(400, 'Selecione um dos quatro estilos disponíveis.');
      if (!req.file) throw new ImageServiceError(400, 'Escolha uma foto para continuar.');
      let image;
      try {
        image = normalizeImage(req.file.buffer);
      } catch { throw new ImageServiceError(400, 'Envie uma foto válida em JPG, PNG ou WebP, com até 40 megapixels.'); }
      const output = await edit({ image, prompt: preset.prompt, signal: controller.signal });
      res.type('png').send(output);
    } catch (error) {
      if (controller.signal.aborted) next(new ImageServiceError(504, 'A edição demorou mais que o esperado. Tente novamente em alguns instantes.'));
      else next(error);
    } finally {
      clearTimeout(timer);
      res.off('close', onClose);
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(express.static(publicPath));
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'A foto deve ter no máximo 15 MB.' : 'Envie uma única foto e um estilo válido.' });
    if (error instanceof ImageServiceError) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Não foi possível concluir a edição. Tente novamente.' });
  });
  return app;
}
