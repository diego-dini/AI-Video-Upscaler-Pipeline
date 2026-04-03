import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a execução do Real-ESRGAN via linha de comando.
 */
export type UpscaleFramesArgs = {
  /** Fator de escala do upscale (ex: 2, 3, 4). Padrão: 4. */
  scale?: number;
  /** Nome do modelo de IA a ser utilizado. Padrão: "realesr-animevideov3". */
  modelName?: string;
  /** IDs das GPUs que serão utilizadas, separadas por vírgula. Padrão: [0] (primeira GPU). */
  gpuId?: number[];
  /** Caminho para o executável do Real-ESRGAN. Padrão: Variável de ambiente ou caminho relativo. */
  realesrgan?: string;
  /** Configuração de threads por etapa de processamento [load:proc:save]. Padrão: ["4:8:4"]. */
  threadCount?: string[];
  /** Tamanho do tile (blocos) para economizar VRAM. Valores menores usam menos memória. Padrão: 512. */
  tile?: number;
};

/**
 * Executa o processo de upscale dos frames de um episódio utilizando a IA Real-ESRGAN.
 * O processo ocorre de forma assíncrona gerando um processo filho (child_process).
 */
export function upscaleFrames(
  episode: Episode,
  {
    scale = 4,
    modelName = "realesr-animevideov3",
    gpuId = [0],
    threadCount = ["4:8:4"],
    // Usa a variável de ambiente OU o caminho relativo por padrão
    realesrgan = process.env.REALESRGAN_PATH ||
      path.join("realesrgan", "realesrgan-ncnn-vulkan.exe"),
    tile = 512,
  }: UpscaleFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!realesrgan) throw new Error("Invalid realesrgan path");

    // Resolve o caminho para garantir que o spawn use o caminho absoluto correto baseado na pasta raiz do projeto
    const executablePath = path.resolve(realesrgan);

    // Verifica se o executável realmente existe antes de tentar rodar
    if (!fs.existsSync(executablePath)) {
      return reject(
        new Error(
          `Executável do Real-ESRGAN não encontrado em: ${executablePath}`,
        ),
      );
    }

    const operationStatus = new OperationStatus("Upscale");
    operationStatus.printMessage("Upscale com IA...");

    // Definição dos diretórios de entrada e saída baseados no ID do episódio
    const framesDir = path.join("temp", "frames", String(episode.id));
    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));

    // Prepara o diretório de saída
    if (fs.existsSync(upscaledDir)) {
      fs.rmSync(upscaledDir, { recursive: true, force: true });
    }
    fs.mkdirSync(upscaledDir, { recursive: true });

    // Montagem dos argumentos para o CLI
    const args = ["-i", framesDir, "-o", upscaledDir, "-v"];

    if (modelName) args.push("-n", modelName);
    if (scale) args.push("-s", scale.toString());
    if (gpuId && gpuId.length > 0) args.push("-g", gpuId.join(","));
    if (threadCount && threadCount.length > 0)
      args.push("-j", threadCount.join(","));
    if (tile) args.push("-t", tile.toString());

    // Inicia o processo filho do Real-ESRGAN usando o caminho resolvido
    const up = spawn(executablePath, args);

    let processed = 0;
    const startTime = Date.now();

    const handleData = (data: Buffer) => {
      const text = data.toString();

      const matches = text.match(
        /frame_\d+\.(jpg|png) -> .*frame_\d+\.(jpg|png) done/g,
      );

      if (matches) {
        processed += matches.length;

        const percent = episode.frames
          ? ((processed / episode.frames) * 100).toFixed(2)
          : "??";

        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = elapsedSec > 0 ? processed / elapsedSec : 0;

        const remainingFrames = episode.frames - processed;
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        operationStatus.updateStatus(
          episode,
          processed,
          episode.frames,
          percent,
          elapsedSec,
          etaSec,
        );
      }
    };

    up.stdout.on("data", handleData);
    up.stderr.on("data", handleData);

    up.on("close", (code) => {
      if (code === 0) {
        operationStatus.printCompleteMessage(0);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(`Erro no upscale: Processo encerrado com código ${code}`),
          );
        });
      }
    });

    up.on("error", (error) => {
      reject(
        new Error(
          `Falha ao iniciar o processo do Real-ESRGAN: ${error.message}`,
        ),
      );
    });
  });
}
