import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a extração de áudio.
 */
export type ExtractAudioArgs = {
  threads?: number;
  audioCodec?: string;
  audioExtension?: string;
  ffmpegPath?: string;
};

/**
 * Extrai apenas o áudio de um arquivo de vídeo usando FFmpeg.
 */
export function extractAudio(
  episode: Episode,
  {
    threads = 8,
    audioCodec = "copy",
    audioExtension = "m4a",
    ffmpegPath = "ffmpeg",
  }: ExtractAudioArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const operationStatus = new OperationStatus("ExtractAudio");
    operationStatus.printMessage("Extraindo áudio do vídeo...");

    const audioPath = path.join(
      "temp",
      "audio",
      `${episode.id}.${audioExtension}`,
    );
    const audioDir = path.dirname(audioPath);

    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    if (fs.existsSync(audioPath)) {
      fs.rmSync(audioPath, { force: true });
    }

    const args: string[] = ["-y"];

    if (threads) args.push("-threads", threads.toString());

    args.push(
      "-i",
      episode.inputPath,
      "-vn", // Ignora o vídeo
      "-acodec",
      audioCodec,
      audioPath,
    );

    const ff = spawn(ffmpegPath, args);

    // Nota: Como a extração de áudio (especialmente com codec "copy") é quase instantânea,
    // não precisamos de um parseador complexo de progresso como o de frames.

    ff.on("close", (code) => {
      if (code === 0) {
        operationStatus.printCompleteMessage(0);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(
              `Erro ao extrair áudio: FFmpeg encerrou com código ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(
        new Error(`Falha ao iniciar o FFmpeg para áudio: ${error.message}`),
      );
    });
  });
}
