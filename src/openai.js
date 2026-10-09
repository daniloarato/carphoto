export class ImageServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createImageEditor({ apiKey, model = 'gpt-image-1.5', fetchImpl = fetch }) {
  return async ({ image, prompt, signal }) => {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('image', new Blob([image], { type: 'image/jpeg' }), 'car.jpg');
    form.set('size', '1536x1024');
    form.set('quality', 'medium');
    form.set('output_format', 'png');
    form.set('n', '1');
    if (model === 'gpt-image-1.5' || model === 'gpt-image-1') form.set('input_fidelity', 'high');
    const response = await fetchImpl('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) throw new ImageServiceError(503, 'A geração está indisponível. Verifique a configuração e o acesso à API.');
      if (status === 429) throw new ImageServiceError(429, 'O serviço atingiu seu limite de uso. Tente novamente mais tarde.');
      if (status === 400) throw new ImageServiceError(422, 'Não foi possível editar esta imagem. Tente outra foto.');
      throw new ImageServiceError(502, 'O serviço de imagens está indisponível. Tente novamente mais tarde.');
    }
    const data = await response.json();
    const base64 = data.data?.[0]?.b64_json;
    if (!base64 || typeof base64 !== 'string') throw new ImageServiceError(502, 'O serviço não retornou uma imagem. Tente novamente.');
    return Buffer.from(base64, 'base64');
  };
}
