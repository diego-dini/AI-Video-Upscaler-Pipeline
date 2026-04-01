import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import printOperationStatus from "./utils/printOperationStatus";
import OperationStatus from "./utils/printOperationStatus";

export function encodeEpisode(episode: Episode): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("3) Recriando vídeo...");

    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));
    const audioPath = path.join("temp", "audio", `${episode.id}.aac`);
    const outputPath = episode.outputPath;

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }

    const args = [
      // vídeo (frames)
      "-framerate",
      String(Math.round(episode.framerate) || 30),
      "-i",
      `${upscaledDir}/frame_%05d.png`,

      // áudio
      "-i",
      audioPath,

      // codecs
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy", // não reencoda áudio (rápido)

      // garante sync
      "-shortest",

      outputPath,
    ];

    const ff = spawn("ffmpeg", args);

    const startTime = Date.now();

    ff.stderr.on("data", (data) => {
      const text = data.toString();

      const match = text.match(/frame=\s*(\d+)/);
      if (match) {
        const frame = parseInt(match[1]);

        const total = episode.frames || 0;
        const percent = total ? ((frame / total) * 100).toFixed(2) : "??";

        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = elapsedSec > 0 ? frame / elapsedSec : 0;

        const remainingFrames = Math.max(0, total - frame);
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        OperationStatus.update(
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

        OperationStatus.complete(totalTime);
        resolve();
      } else {
        reject(new Error(`Erro ao gerar vídeo (code ${code})`));
      }
    });

    ff.on("error", reject);
  });
}
