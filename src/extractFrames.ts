import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configuration options for frame extraction using FFmpeg.
 */
export type ExtractFramesArgs = {
  /** Hardware acceleration method. Default: "cuda". */
  hwaccel?: string;
  /** Number of threads to be used by FFmpeg. Default: 8. */
  threads?: number;
  /** Output image quality (lower is better quality for some codecs). Default: 2. */
  videoQuality?: number;
  /** Frame image extension. Default: "png". Can be "jpg". */
  frameExtension?: "jpg" | "png";
  /** Path to the FFmpeg executable. Default: "ffmpeg" (expects it to be available in PATH). */
  ffmpegPath?: string;
};

/**
 * Extracts frames from a video file using FFmpeg.
 *
 * Steps performed:
 * 1. Removes any existing frame directory to ensure a clean state.
 * 2. Creates the output directory for extracted frames.
 * 3. Invokes FFmpeg to decode the video into a sequence of images.
 * 4. Displays real-time progress based on FFmpeg stderr output.
 *
 * @param episode - Object containing episode metadata and file paths.
 * @param options - Optional configuration for hardware acceleration, quality, and paths.
 * @returns A Promise that resolves on successful extraction or rejects on error.
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
    operationStatus.printMessage("Extracting frames from video...");

    const framesDir = path.join("temp", "frames", String(episode.id));

    // Remove existing frame directory to ensure a clean extraction
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }

    // Create output directory for frames
    fs.mkdirSync(framesDir, { recursive: true });

    const frameOutputPattern = path.join(
      framesDir,
      `frame_%05d.${frameExtension}`,
    );

    const args: string[] = ["-y"];

    // Apply optional hardware acceleration and threading
    if (hwaccel) args.push("-hwaccel", hwaccel);
    if (threads) args.push("-threads", threads.toString());

    args.push(
      "-i",
      episode.inputPath,

      // Scale frames to 480p resolution (854x480)
      "-vf",
      "scale=854:480",

      // Force constant frame rate extraction
      "-r",
      episode.framerate.toString(),

      // Define output image quality
      "-q:v",
      videoQuality.toString(),

      // Output destination pattern
      frameOutputPattern,
    );

    const ff = spawn(ffmpegPath, args);
    const startTime = Date.now();

    /**
     * FFmpeg outputs progress and logs through stderr instead of stdout.
     */
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
              `Failed to extract frames: FFmpeg exited with code ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(
        new Error(
          `Failed to start FFmpeg process for frame extraction: ${error.message}`,
        ),
      );
    });
  });
}
