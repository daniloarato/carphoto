# CarPhoto

Estúdio web de edição de fotos automotivas, com câmera no celular, upload, quatro perspectivas, comparação do original com o resultado e download em PNG. Interface em português, responsiva, inspirada nos tokens do guia `DESIGN-ferrari.md`: grafite `#181818`, vermelho `#da291c`, tipografia de sistema, linhas finas e cantos retos. Não usa a marca nem a fonte proprietária FerrariSans. A fotografia de abertura foi gerada por IA para este projeto.

## Executar

Requer Node.js 24 ou superior. Os comandos de inicialização respeitam os proxies HTTP/HTTPS do ambiente, inclusive para a autenticação injetada pela plataforma.

```sh
cd /workspace/carphoto
npm ci
npm run dev
```

O servidor atende na porta 3000, em `127.0.0.1`. Use `npm start` sem o observador de arquivos. Não há etapa de build: o Express serve o frontend estático e a API na mesma origem.

Configure `CARPHOTO_API_KEY` de forma segura no servidor ou no arquivo local `.env` ignorado pelo Git (veja `.env.example`). Também é aceito `OPENAI_API_KEY` em instalações próprias. Nunca adicione chaves ao frontend ou ao repositório. O ambiente em nuvem usa `CARPHOTO_API_KEY`, pois o prefixo `OPENAI_` é reservado no cadastro de segredos da plataforma. A chave precisa ter acesso ao modelo de imagens e saldo/limite disponível. Reinicie o servidor após alterar variáveis.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `CARPHOTO_API_KEY` | sem valor | Credencial do servidor para a OpenAI |
| `CARPHOTO_IMAGE_MODEL` | `gpt-image-1.5` | Modelo compatível com edição de imagens |
| `HOST` | `127.0.0.1` | Interface do servidor |
| `PORT` | `3000` | Porta HTTP |

`GET /api/health` informa `generationConfigured`: isso indica presença de configuração, não valida o acesso à OpenAI. Sem chave, o estúdio permite selecionar e visualizar a foto e escolher estilos; a geração fica desabilitada com uma mensagem explicativa.

## Como funciona

1. A câmera usa o seletor nativo do celular (`capture="environment"`); o comportamento depende do navegador/dispositivo. Upload e arrastar uma foto também funcionam.
2. O navegador aceita JPG, PNG e WebP de até 15 MB e 40 megapixels. HEIC precisa ser convertido antes. A imagem é normalizada para JPEG, limitada a 2048 pixels no maior lado e enviada sem metadados.
3. `POST /api/edit` recebe `multipart/form-data` com `image` e `preset`. O servidor valida o conteúdo real da imagem, reencoda o arquivo, escolhe um prompt fixo e chama `POST https://api.openai.com/v1/images/edits`.
4. A saída é um PNG de 1536 × 1024, qualidade `medium`, uma imagem por solicitação. O navegador apresenta original e resultado e permite baixar a edição.

Os nomes abaixo são presets deste app, **não comandos nativos documentados da API**. Os prompts estão em `src/presets.js` e podem ser ajustados caso existam instruções específicas de um GPT personalizado.

| Preset | Direção |
| --- | --- |
| `/proshot` | Refinar luz, reflexos e acabamento, preservando o ângulo original |
| `/droneview` | Perspectiva aérea elevada em aproximadamente 45 graus |
| `/lowangle` | Câmera próxima ao solo, vista frontal em três quartos |
| `/rollingview` | Cena em movimento, carro nítido e desfoque direcional de fundo/rodas |

Os prompts pedem preservação da identidade do carro. Ângulos novos exigem reconstrução de partes não visíveis e podem alterar detalhes: revise o resultado antes de usar em anúncios.

As imagens não são gravadas pelo servidor em disco. A original e a saída ficam na memória da página até sua substituição ou fechamento. A foto é enviada à OpenAI quando o usuário solicita a geração, sujeita às condições de tratamento de dados da API. Cada solicitação real usa a API e pode gerar cobrança.

## Validação

```sh
npm test
npm run test:ui
npm audit --omit=dev
```

Os testes da API usam respostas simuladas do provedor para validar processamento de upload, os quatro presets, limites, concorrência, contrato HTTP e erros. Os testes de navegador exercitam desktop e celular, upload/câmera via seletor simulado, download, falhas, ausência da chave e layout. Usam Chromium do sistema quando disponível; alternativamente configure `CHROMIUM_PATH` ou instale o navegador com `npx playwright install chromium`.

Geração real exige uma chave válida e uma foto de carro; respostas simuladas não demonstram qualidade visual nem acesso real ao modelo. A abertura física da câmera deve ser verificada em um celular.

## Escopo desta primeira versão

Aplicação para desenvolvimento e uso individual, sem contas, histórico persistente ou cobrança. O servidor limita a uma edição simultânea e cinco tentativas por minuto por processo. Antes de disponibilizar publicamente, adicione autenticação, cotas por usuário e armazenamento adequado; o limite global atual não substitui esses controles. Para acesso de um celular em outra máquina, configure um domínio HTTPS e o roteamento apropriado para o servidor.

O ambiente de cada tarefa já é isolado: use este checkout existente; não crie worktrees sem solicitação explícita.
