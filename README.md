# 🚀 AI Video Upscaler Pipeline

Um pipeline automatizado e de alta performance para fazer **upscale de vídeos** (ideal para animes e animações) utilizando a Inteligência Artificial **Real-ESRGAN** e o poder do **FFmpeg**.

Desenvolvido em **TypeScript** e rodando em cima do **Bun** 🥟 (substituto ultra-rápido para o Node.js).

---

## ⚙️ Pré-requisitos

Antes de rodar o projeto, você precisa ter as seguintes ferramentas instaladas no seu sistema:

1. **[Bun](https://bun.sh/)**: O runtime principal do projeto.
2. **[FFmpeg](https://ffmpeg.org/download.html)**: Necessário para manipulação de áudio e vídeo. Certifique-se de que o `ffmpeg` e o `ffprobe` estejam adicionados às variáveis de ambiente (`PATH`) do seu sistema.
3. **[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN/releases)**: O modelo de IA não vem embutido no projeto. Você deve baixar a versão CLI (ex: `realesrgan-ncnn-vulkan`) separadamente.

---

## 🛠️ Instalação e Configuração

**1. Clone o repositório e instale as dependências:**

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
bun install
```

**2. Crie a pasta de entrada:**
A pasta de inputs não é enviada para o Git. Você deve criá-la manualmente na raiz do projeto:

```bash
mkdir inputs
```

_(Nota: A pasta `outputs` não precisa ser criada manualmente, o script a criará automaticamente durante a execução)._

**3. Configure o caminho do Real-ESRGAN:**
Abra o seu arquivo `.env` (ou a configuração dentro de `src/UpscaleFrames.ts`) e aponte para o caminho absoluto do executável do Real-ESRGAN que você baixou.

```env
# Exemplo de arquivo .env
REALESRGAN_PATH="C:\caminho\para\realesrgan-ncnn-vulkan.exe"
VERBOSE="true"
```

---

## 🚀 Como Usar

1. Coloque seus arquivos de vídeo originais (`.mp4` ou `.mkv`) dentro da pasta `inputs/`.
2. Execute o comando principal através do Bun:

```bash
bun run dev
```

3. Acompanhe o terminal! O sistema possui uma interface de linha de comando (CLI) limpa e profissional que mostra o progresso, taxa de quadros (FPS) e o tempo estimado (ETA) de cada etapa.
4. Quando finalizado, o vídeo em alta resolução estará disponível na pasta `outputs/`.

---

## 🧠 Como Funciona (A Pipeline)

O script não apenas aumenta a resolução do vídeo, ele orquestra todo um fluxo de trabalho profissional para garantir que não haja perda de áudio ou dessincronização:

- **1️⃣ Scanner (`getEpisodes`)**: Lê a pasta `inputs/`, verifica a integridade dos vídeos e extrai metadados essenciais (Framerate, Duração, Total de Frames) usando o `ffprobe`.
- **2️⃣ Extract (`extractFrames`)**: Usa o FFmpeg (com aceleração de hardware opcional) para extrair o áudio original sem perdas e quebrar o vídeo frame por frame em imagens.
- **3️⃣ Upscale (`upscaleFrames`)**: Envia frame por frame para o Real-ESRGAN, que utiliza IA para aumentar a resolução e remover ruídos/artefatos de compressão.
- **4️⃣ Encode (`encodeEpisode`)**: Junta os novos frames em alta resolução com o áudio original, gerando o arquivo final `.mp4`.
- **5️⃣ Cleanup (`cleanEpisodeTemp`)**: Exclui os milhares de frames temporários para liberar espaço no seu disco rígido e passa para o próximo vídeo da fila.

---

## 📂 Estrutura de Pastas Esperada

Para referência, veja como sua pasta raiz deve ficar enquanto o script roda:

```text
📦 projeto/
 ┣ 📂 inputs/            <- (Crie manualmente) Coloque os vídeos aqui
 ┣ 📂 outputs/           <- (Gerado automaticamente) Vídeos upscaled salvos aqui
 ┣ 📂 temp/              <- (Gerado automaticamente) Pastas de frames e áudios
 ┣ 📂 src/               <- Código fonte TypeScript
 ┣ 📜 package.json
 ┣ 📜 bun.lockb
 ┣ 📜 .env
 ┗ 📜 README.md
```

---

## 📝 Notas e Recomendações

- **Armazenamento:** O processo de extração gera **milhares** de imagens temporárias (ex: um vídeo de 20 min a 24fps gera cerca de 28.000 imagens). Certifique-se de ter espaço livre no disco (preferencialmente em um SSD/NVMe) antes de iniciar.
- **Hardware:** O upscale via IA exige muito processamento. Por padrão, o script tentará utilizar a GPU.

````

---

### Dica:
Como você comentou que usa o **Bun**, se ainda não o fez, no seu `package.json` o seu script `dev` deve estar configurado mais ou menos assim:

```json
"scripts": {
  "dev": "bun run src/Pipeline.ts"
}
````
