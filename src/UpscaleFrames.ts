import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/printOperationStatus";

//TODO PADRONIZAR NOMES DE VARIAVEIS UTILIZADAS NO OPERATION STATUS
//TODO DEFINIR VARIAVEL NO CONFIG PARA O REALESGRAN

type upscaleFramesArgs = {
  scale?: number;
  modelName?: string;
  gpuId?: number;
  realesrgan?: string;
};

export function upscaleFrames(
  episode: Episode,
  {
    scale = 4,
    modelName = "realesr-animevideov3",
    gpuId = 0,
    realesrgan = "C:\\Users\\Diego Dini\\Downloads\\AAA\\realesrgan\\realesrgan-ncnn-vulkan.exe",
  }: upscaleFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("2) Upscale com IA...");

    // diretórios padrão
    const framesDir = path.join("temp", "frames", String(episode.id));
    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));

    // garante pasta de saída
    if (fs.existsSync(upscaledDir)) {
      fs.rmSync(upscaledDir, { recursive: true, force: true });
    }
    fs.mkdirSync(upscaledDir, { recursive: true });

    // argumentos do Real-ESRGAN
    const args = [
      "-i",
      framesDir,
      "-o",
      upscaledDir,
      "-n",
      modelName,
      "-s",
      scale.toString(),
      "-g",
      gpuId.toString(),
      "-j",
      "4:8:4",
      "-t",
      "6144",
      "-v",
    ];

    const up = spawn(realesrgan, args);

    let processed = 0;

    // marca tempo inicial
    const startTime = Date.now();

    // função pra formatar tempo (segundos → mm:ss)
    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}m ${s}s`;
    };

    const handleData = (data: Buffer) => {
      const text = data.toString();

      // detecta frames finalizados (linha "done")
      const matches = text.match(
        /frame_\d+\.(jpg|png) -> .*frame_\d+\.(jpg|png) done/g,
      );

      if (matches) {
        processed += matches.length;

        // % progresso
        const percent = episode.frames
          ? ((processed / episode.frames) * 100).toFixed(2)
          : "??";

        // tempo passado
        const elapsedSec = (Date.now() - startTime) / 1000;

        // velocidade (frames por segundo)
        const fps = processed / elapsedSec;

        // estimativa restante
        const remainingFrames = episode.frames - processed;
        const etaSec = fps > 0 ? remainingFrames / fps : 0;

        OperationStatus.update(
          episode,
          processed,
          episode.frames,
          percent,
          elapsedSec,
          etaSec,
        );
      }
    };

    // escuta stdout e stderr (robusto)
    up.stdout.on("data", handleData);
    up.stderr.on("data", handleData);

    up.on("close", (code) => {
      if (code === 0) {
        OperationStatus.complete(0);
        resolve();
      } else {
        reject(new Error("Erro no upscale"));
      }
    });

    up.on("error", reject);
  });
}
