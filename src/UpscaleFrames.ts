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
  /** Caminho absoluto para o executável do Real-ESRGAN. */
  realesrgan?: string;
  /** Configuração de threads por etapa de processamento [load:proc:save]. Padrão: ["4:8:4"]. */
  threadCount?: string[];
  /** Tamanho do tile (blocos) para economizar VRAM. Valores menores usam menos memória. Padrão: 512. */
  tile?: number;
};

/**
 * Executa o processo de upscale dos frames de um episódio utilizando a IA Real-ESRGAN.
 * O processo ocorre de forma assíncrona gerando um processo filho (child_process).
 *
 * @param episode - Objeto contendo os metadados do episódio (ID, total de frames, etc.).
 * @param options - Objeto opcional com as configurações de upscale e caminhos do executável.
 * @returns Uma Promise que resolve quando o processo terminar com sucesso, ou rejeita em caso de erro.
 * @throws {Error} Rejeita a Promise se o processo filho retornar um código diferente de 0.
 */
export function upscaleFrames(
  episode: Episode,
  {
    scale = 4,
    modelName = "realesr-animevideov3",
    gpuId = [0],
    threadCount = ["4:8:4"],
    realesrgan = process.env.REALESRGAN_PATH,
    tile = 512,
  }: UpscaleFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!realesrgan) throw new Error("Invalid realesrgan path");
    const operationStatus = new OperationStatus("Upscale");
    operationStatus.printMessage("2) Upscale com IA...");

    // Definição dos diretórios de entrada e saída baseados no ID do episódio
    const framesDir = path.join("temp", "frames", String(episode.id));
    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));

    // Prepara o diretório de saída: remove caso exista para evitar mistura de arquivos velhos e recria
    if (fs.existsSync(upscaledDir)) {
      fs.rmSync(upscaledDir, { recursive: true, force: true });
    }
    fs.mkdirSync(upscaledDir, { recursive: true });

    // Montagem dos argumentos para o CLI (Command Line Interface) do Real-ESRGAN
    const args = ["-i", framesDir, "-o", upscaledDir, "-v"];

    if (modelName) {
      args.push("-n", modelName);
    }
    if (scale) {
      args.push("-s", scale.toString());
    }
    if (gpuId && gpuId.length > 0) {
      args.push("-g", gpuId.join(","));
    }
    if (threadCount && threadCount.length > 0) {
      args.push("-j", threadCount.join(","));
    }
    if (tile) {
      args.push("-t", tile.toString());
    }

    // Inicia o processo filho do Real-ESRGAN
    const up = spawn(realesrgan, args);

    let processed = 0;
    const startTime = Date.now();

    /**
     * Processa os logs emitidos pelo Real-ESRGAN para extrair o progresso atual.
     * @param data - Buffer de dados vindos do stdout ou stderr.
     */
    const handleData = (data: Buffer) => {
      const text = data.toString();

      // Expressão regular para capturar linhas de frames concluídos (ex: frame_001.jpg -> frame_001.jpg done)
      const matches = text.match(
        /frame_\d+\.(jpg|png) -> .*frame_\d+\.(jpg|png) done/g,
      );

      if (matches) {
        processed += matches.length;

        // Cálculos de progresso e estimativas
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

    // O Real-ESRGAN pode emitir logs de progresso tanto na saída padrão quanto na de erro
    up.stdout.on("data", handleData);
    up.stderr.on("data", handleData);

    // Gerenciamento de encerramento do processo
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
