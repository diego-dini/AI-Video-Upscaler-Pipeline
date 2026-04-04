import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configuration options for running Real-ESRGAN via command line.
 */
export type UpscaleFramesArgs = {
  /** Upscale factor (e.g., 2, 3, 4). Default: 4. */
  scale?: number;
  /** AI model name to be used. Default: "realesr-animevideov3". */
  modelName?: string;
  /** GPU IDs to be used, separated by commas. Default: [0] (first GPU). */
  gpuId?: number[];
  /** Path to the Real-ESRGAN executable. Default: environment variable or relative path. */
  realesrgan?: string;
  /** Thread configuration per stage [load:proc:save]. Default: ["4:8:4"]. */
  threadCount?: string[];
  /** Tile size (blocks) to reduce VRAM usage. Lower values use less memory. Default: 512. */
  tile?: number;
};

/**
 * Performs AI-based upscaling of episode frames using Real-ESRGAN.
 *
 * Steps performed:
 * 1. Validates and resolves the executable path.
 * 2. Ensures input and output directories are correctly prepared.
 * 3. Invokes Real-ESRGAN CLI with the configured parameters.
 * 4. Tracks progress in real time based on process output.
 *
 * @param episode - Object containing episode metadata and file paths.
 * @param options - Optional configuration for scaling, model, GPU, and performance tuning.
 * @returns A Promise that resolves on successful completion or rejects on error.
 */
export function upscaleFrames(
  episode: Episode,
  {
    scale = 4,
    modelName = "realesr-animevideov3",
    gpuId = [0],
    threadCount = ["4:8:4"],
    realesrgan = process.env.REALESRGAN_PATH ||
      path.join("realesrgan", "realesrgan-ncnn-vulkan.exe"),
    tile = 512,
  }: UpscaleFramesArgs = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!realesrgan) throw new Error("Invalid realesrgan path");

    // Resolve executable path to ensure correct absolute reference
    const executablePath = path.resolve(realesrgan);

    // Validate that the executable exists before running
    if (!fs.existsSync(executablePath)) {
      return reject(
        new Error(`Real-ESRGAN executable not found at: ${executablePath}`),
      );
    }

    const operationStatus = new OperationStatus("Upscale");
    operationStatus.printMessage("Running AI upscaling...");

    // Define input and output directories based on episode ID
    const framesDir = path.join("temp", "frames", String(episode.id));
    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));

    // Prepare output directory
    if (fs.existsSync(upscaledDir)) {
      fs.rmSync(upscaledDir, { recursive: true, force: true });
    }
    fs.mkdirSync(upscaledDir, { recursive: true });

    // Build CLI arguments
    const args = ["-i", framesDir, "-o", upscaledDir, "-v"];

    if (modelName) args.push("-n", modelName);
    if (scale) args.push("-s", scale.toString());
    if (gpuId && gpuId.length > 0) args.push("-g", gpuId.join(","));
    if (threadCount && threadCount.length > 0) {
      args.push("-j", threadCount.join(","));
    }
    if (tile) args.push("-t", tile.toString());

    // Start Real-ESRGAN process using resolved executable path
    const up = spawn(executablePath, args);

    let processed = 0;
    const startTime = Date.now();

    /**
     * Real-ESRGAN outputs progress through stdout/stderr.
     * Each completed frame is parsed and counted to estimate progress.
     */
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
            new Error(`Upscaling failed: process exited with code ${code}`),
          );
        });
      }
    });

    up.on("error", (error) => {
      reject(
        new Error(`Failed to start Real-ESRGAN process: ${error.message}`),
      );
    });
  });
}
