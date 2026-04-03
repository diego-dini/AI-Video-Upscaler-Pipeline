import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a codificação de vídeo utilizando o FFmpeg.
 */
export type EncodeEpisodeArgs = {
  /** Codec de vídeo a ser utilizado. Padrão: "h264_nvenc" (Hardware de Nvidia). Para CPU use "libx264". */
  videoCodec?: string;
  /** Codec de áudio a ser utilizado. Padrão: "copy" (mantém o original sem recodificar, muito mais rápido). */
  audioCodec?: string;
  /** Formato de pixel. Padrão: "yuv420p" (maior compatibilidade com players comuns). */
  pixelFormat?: string;
  /** Extensão das imagens de input (upscaled). Padrão: "png". Pode ser "jpg". */
  frameExtension?: "png" | "jpg";
  /** Caminho do executável do FFmpeg. Padrão: "ffmpeg" (espera que esteja nas variáveis de ambiente/PATH). */
  audioExtension?: string;
  /** Extensão do arquivo de audio. Padrão "m4a" */
  ffmpegPath?: string;
};

/**
 * Combina os frames upscaled e o arquivo de áudio para gerar o arquivo de vídeo final (.mp4/.mkv).
 *
 * Etapas realizadas:
 * 1. Confirma e cria (se necessário) a pasta de destino.
 * 2. Remove o vídeo antigo caso já exista para evitar conflitos.
 * 3. Chama o FFmpeg para fazer o multiplexing (Mux) de vídeo e áudio.
 * 4. Exibe o progresso em tempo real baseado no STDERR emitido pelo FFmpeg.
 *
 * @param episode - Objeto contendo os metadados do episódio e caminhos de arquivo.
 * @param options - Objeto opcional com configurações de codec, formatos e caminhos.
 * @returns Uma Promise que resolve na conclusão da renderização ou rejeita em caso de erro.
 */
export function encodeEpisode(
  episode: Episode,
  {
    videoCodec = "h264_nvenc",
    audioCodec = "copy",
    pixelFormat = "yuv420p",
    frameExtension = "png",
    audioExtension = "m4a",
    ffmpegPath = "ffmpeg",
  }: EncodeEpisodeArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const operationStatus = new OperationStatus("Encode");
    operationStatus.printMessage("Recriando vídeo...");

    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));
    const audioPath = path.join(
      "temp",
      "audio",
      `${episode.id}.${audioExtension}`,
    );
    const outputPath = episode.outputPath;
    // Garante que o diretório final exista
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Remove arquivo existente para não dar conflito de permissão com o FFmpeg
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }

    // Padrão de input do FFmpeg para sequencia de imagens (ex: pasta/frame_00001.png)
    const frameInputPattern = path.join(
      upscaledDir,
      `frame_%05d.${frameExtension}`,
    );

    const args = [
      // Força sobreposição de arquivo, caso o fs.rmSync tenha falhado silenciosamente
      "-y",

      // Input do vídeo (frames em sequência)
      "-framerate",
      String(episode.framerate || 30),
      "-i",
      frameInputPattern,

      // Input do áudio
      "-i",
      audioPath,

      // Configuração de Codecs
      "-c:v",
      videoCodec,
      "-pix_fmt",
      pixelFormat,
      "-c:a",
      audioCodec,

      // Output final
      outputPath,
    ];

    const ff = spawn(ffmpegPath, args);

    const startTime = Date.now();

    /**
     * O FFmpeg envia seus logs de progresso e informações pela saída padrão de ERRO (stderr), e não pelo stdout.
     */
    ff.stderr.on("data", (data: Buffer) => {
      const text = data.toString();

      // Expressão regular que busca a string "frame=  123" no terminal do FFmpeg
      const match = text.match(/frame=\s*(\d+)/);
      if (match) {
        const frame = parseInt(match[1]!);

        const total = episode.frames || 0;
        const percent = total ? ((frame / total) * 100).toFixed(2) : "??";

        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = elapsedSec > 0 ? frame / elapsedSec : 0;

        const remainingFrames = Math.max(0, total - frame);
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        operationStatus.updateStatus(
          episode,
          frame,
          total,
          percent,
          elapsedSec,
          etaSec,
        );
      }
    });

    ff.on("close", (code) => {
      if (code === 0) {
        const totalTime = (Date.now() - startTime) / 1000;
        operationStatus.printCompleteMessage(totalTime);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(
              `Erro ao gerar vídeo: FFmpeg encerrou com código ${code}`,
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
