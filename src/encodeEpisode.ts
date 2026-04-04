import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configuration options for video encoding using FFmpeg.
 */
export type EncodeEpisodeArgs = {
  /** Video codec to be used. Default: "h264_nvenc" (NVIDIA hardware). Use "libx264" for CPU encoding. */
  videoCodec?: string;
  /** Audio codec to be used. Default: "copy" (keeps original without re-encoding, much faster). */
  audioCodec?: string;
  /** Pixel format. Default: "yuv420p" (higher compatibility with common players). */
  pixelFormat?: string;
  /** Input frame image extension (upscaled). Default: "png". Can be "jpg". */
  frameExtension?: "png" | "jpg";
  /** Audio file extension. Default: "m4a". */
  audioExtension?: string;
  /** Path to the FFmpeg executable. Default: "ffmpeg" (expects it to be available in PATH). */
  ffmpegPath?: string;
};

/**
 * Combines upscaled frames and the audio file to generate the final video file (.mp4/.mkv).
 *
 * Steps performed:
 * 1. Ensures the output directory exists (creates it if necessary).
 * 2. Removes any existing output file to avoid conflicts.
 * 3. Invokes FFmpeg to multiplex (mux) video and audio.
 * 4. Displays real-time progress based on FFmpeg stderr output.
 *
 * @param episode - Object containing episode metadata and file paths.
 * @param options - Optional configuration for codecs, formats, and paths.
 * @returns A Promise that resolves on successful completion or rejects on error.
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
    operationStatus.printMessage("Rebuilding video...");

    const upscaledDir = path.join("temp", "framesUpscaled", String(episode.id));
    const audioPath = path.join(
      "temp",
      "audio",
      `${episode.id}.${audioExtension}`,
    );
    const outputPath = episode.outputPath;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Remove existing file to avoid permission conflicts with FFmpeg
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }

    // FFmpeg input pattern for image sequence (e.g., folder/frame_00001.png)
    const frameInputPattern = path.join(
      upscaledDir,
      `frame_%05d.${frameExtension}`,
    );

    const args = [
      // Force overwrite in case removal failed silently
      "-y",

      // Video input (frame sequence)
      "-framerate",
      String(episode.framerate || 30),
      "-i",
      frameInputPattern,

      // Audio input
      "-i",
      audioPath,

      // Codec configuration
      "-c:v",
      videoCodec,
      "-pix_fmt",
      pixelFormat,
      "-c:a",
      audioCodec,

      // Final output
      outputPath,
    ];

    const ff = spawn(ffmpegPath, args);

    const startTime = Date.now();

    /**
     * FFmpeg outputs progress and logs through stderr instead of stdout.
     */
    ff.stderr.on("data", (data: Buffer) => {
      const text = data.toString();

      // Regex to capture "frame=  123" from FFmpeg output
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
              `Failed to encode video: FFmpeg exited with code ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(new Error(`Failed to start FFmpeg process: ${error.message}`));
    });
  });
}
