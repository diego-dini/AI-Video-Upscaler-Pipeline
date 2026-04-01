import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/printOperationStatus";

//TODO PADRONIZAR NOMES DE VARIAVEIS UTILIZADAS NO OPERATION STATUS

export async function extractFrames(episode: Episode): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("1) Extraindo frames + áudio...");

    const framesDir = path.join("temp", "frames", String(episode.id));
    const audioPath = path.join("temp", "audio", `${episode.id}.aac`);

    // limpa frames
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(framesDir, { recursive: true });

    // garante pasta de áudio
    const audioDir = path.dirname(audioPath);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // ffmpeg: extrai frames + áudio ao mesmo tempo
    const args = [
      "-hwaccel",
      "cuda",
      "-threads",
      "8",
      "-i",
      episode.inputPath,

      // vídeo → frames
      "-q:v",
      "2",
      `${framesDir}/frame_%05d.jpg`,

      // áudio separado
      "-vn",
      "-acodec",
      "copy",
      audioPath,
    ];

    const ff = spawn("ffmpeg", args);

    const startTime = Date.now();

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}m ${s}s`;
    };

    ff.stderr.on("data", (data) => {
      const text = data.toString();

      const match = text.match(/frame=\s*(\d+)/);
      if (match) {
        const currentFrame = parseInt(match[1]);

        const percent = episode.frames
          ? ((currentFrame / episode.frames) * 100).toFixed(2)
          : "??";

        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = elapsedSec > 0 ? currentFrame / elapsedSec : 0;

        const remainingFrames = episode.frames - currentFrame;
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        OperationStatus.update(
          episode,
          currentFrame,
          episode.frames,
          percent,
          elapsedSec,
          etaSec,
        );
      }
    });

    ff.on("close", (code) => {
      if (code === 0) {
        OperationStatus.complete(0);
        resolve();
      } else {
        reject(new Error("Erro ao extrair frames/áudio"));
      }
    });

    ff.on("error", reject);
  });
}
