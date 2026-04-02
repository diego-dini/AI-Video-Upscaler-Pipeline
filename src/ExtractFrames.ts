import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a extração de frames e áudio utilizando o FFmpeg.
 */
export type ExtractFramesArgs = {
  /** Aceleração de hardware para decodificação. Padrão: "cuda" (Nvidia). Use "auto" ou deixe vazio para CPU. */
  hwaccel?: string;
  /** Número de threads para o processamento do FFmpeg. Padrão: 8. */
  threads?: number;
  /** Qualidade de compressão da imagem extraída (escala q:v). Menor = mais qualidade. Padrão: 2. */
  videoQuality?: number;
  /** Extensão dos frames extraídos. Padrão: "jpg". Pode ser "png". */
  frameExtension?: "jpg" | "png";
  /** Codec de áudio a ser extraído. Padrão: "copy" (mantém o codec original, muito rápido). */
  audioCodec?: string;
  /** Extensão do arquivo de áudio gerado. Padrão: "aac". */
  audioExtension?: string;
  /** Caminho do executável do FFmpeg. Padrão: "ffmpeg". */
  ffmpegPath?: string;
};

/**
 * Extrai os frames e o áudio de um arquivo de vídeo (Episódio) usando FFmpeg.
 *
 * O processo gera duas saídas simultâneas:
 * 1. Uma sequência de imagens em `temp/frames/{episode.id}/frame_00001.jpg`
 * 2. Um arquivo de áudio em `temp/audio/{episode.id}.aac`
 *
 * @param episode - Objeto contendo os metadados e caminhos de entrada do episódio.
 * @param options - Configurações opcionais de extração (threads, codecs, qualidade).
 * @returns Promise que resolve na conclusão da extração ou rejeita em caso de erro.
 */
export function extractFrames(
  episode: Episode,
  {
    hwaccel = "cuda",
    threads = 8,
    videoQuality = 2,
    frameExtension = "jpg",
    audioCodec = "copy",
    audioExtension = "aac",
    ffmpegPath = "ffmpeg",
  }: ExtractFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const operationStatus = new OperationStatus("Extract");
    operationStatus.printMessage("1) Extraindo frames + áudio...");

    // Definição dos caminhos
    const framesDir = path.join("temp", "frames", String(episode.id));
    const audioPath = path.join(
      "temp",
      "audio",
      `${episode.id}.${audioExtension}`,
    );

    // Limpa a pasta de frames antiga, se existir
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(framesDir, { recursive: true });

    // Garante que a pasta de áudio exista e remove áudio antigo (evita travamento do FFmpeg)
    const audioDir = path.dirname(audioPath);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    if (fs.existsSync(audioPath)) {
      fs.rmSync(audioPath, { force: true });
    }

    // Padrão de saída dos frames
    const frameOutputPattern = path.join(
      framesDir,
      `frame_%05d.${frameExtension}`,
    );

    // Construção dos argumentos do FFmpeg
    const args: string[] = [
      "-y", // Força sobrescrita de arquivos
    ];

    if (hwaccel) {
      args.push("-hwaccel", hwaccel);
    }

    if (threads) {
      args.push("-threads", threads.toString());
    }

    // Input
    args.push("-i", episode.inputPath);

    // Configurações da saída de Vídeo (Frames)
    args.push("-q:v", videoQuality.toString(), frameOutputPattern);

    // Configurações da saída de Áudio
    args.push(
      "-vn", // Desabilita o processamento de vídeo para este output
      "-acodec",
      audioCodec,
      audioPath,
    );

    // Inicia o processo filho
    const ff = spawn(ffmpegPath, args);

    const startTime = Date.now();

    /**
     * Monitora o progresso através do STDERR do FFmpeg
     */
    ff.stderr.on("data", (data: Buffer) => {
      const text = data.toString();

      // Busca a quantidade de frames já extraídos (ex: frame=  150)
      const match = text.match(/frame=\s*(\d+)/);
      if (match) {
        const currentFrame = parseInt(match[1]!);

        // Cálculos de progresso e estimativas
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

    // Finalização do processo
    ff.on("close", (code) => {
      if (code === 0) {
        operationStatus.printCompleteMessage(0);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(
              `Erro ao extrair frames/áudio: FFmpeg encerrou com código ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(
        new Error(`Falha ao iniciar o processo do FFmpeg: ${error.message}`),
      );
    });
  });
}
