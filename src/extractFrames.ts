import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a extração de frames.
 */
export type ExtractFramesArgs = {
  hwaccel?: string;
  threads?: number;
  videoQuality?: number;
  frameExtension?: "jpg" | "png";
  ffmpegPath?: string;
};

/**
 * Extrai apenas os frames de um arquivo de vídeo usando FFmpeg.
 */
export function extractFrames(
  episode: Episode,
  {
    hwaccel = "cuda",
    threads = 8,
    videoQuality = 2,
    frameExtension = "png",
    ffmpegPath = "ffmpeg",
  }: ExtractFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const operationStatus = new OperationStatus("ExtractFrames");
    operationStatus.printMessage("Extraindo frames do vídeo...");

    const framesDir = path.join("temp", "frames", String(episode.id));

    // Limpa a pasta de frames antiga, se existir
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(framesDir, { recursive: true });

    const frameOutputPattern = path.join(
      framesDir,
      `frame_%05d.${frameExtension}`,
    );

    const args: string[] = ["-y"];

    if (hwaccel) args.push("-hwaccel", hwaccel);
    if (threads) args.push("-threads", threads.toString());

    args.push(
      "-i",
      episode.inputPath,

      // 1. Força a extração de frames constantes (CFR)
      "-r",
      episode.framerate.toString(),

      // 2. Define a qualidade da imagem
      "-q:v",
      videoQuality.toString(),

      // 3. Destino da saída
      frameOutputPattern,
    );

    const ff = spawn(ffmpegPath, args);
    const startTime = Date.now();

    ff.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/frame=\s*(\d+)/);

      if (match) {
        const currentFrame = parseInt(match[1]!);
        const percent = episode.frames
          ? ((currentFrame / episode.frames) * 100).toFixed(2)
          : "??";

        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = elapsedSec > 0 ? currentFrame / elapsedSec : 0;
        const remainingFrames = episode.frames
          ? episode.frames - currentFrame
          : 0;
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        operationStatus.updateStatus(
          episode,
          currentFrame,
          episode.frames || 0,
          percent,
          elapsedSec,
          etaSec,
        );
      }
    });

    ff.on("close", (code) => {
      if (code === 0) {
        operationStatus.printCompleteMessage(0);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(
              `Erro ao extrair frames: FFmpeg encerrou com código ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(
        new Error(`Falha ao iniciar o FFmpeg para frames: ${error.message}`),
      );
    });
  });
}
