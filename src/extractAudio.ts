import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configuration options for audio extraction using FFmpeg.
 */
export type ExtractAudioArgs = {
  /** Number of threads to be used by FFmpeg. Default: 8. */
  threads?: number;
  /** Audio codec to be used. Default: "copy" (keeps original without re-encoding, much faster). */
  audioCodec?: string;
  /** Audio file extension. Default: "m4a". */
  audioExtension?: string;
  /** Path to the FFmpeg executable. Default: "ffmpeg" (expects it to be available in PATH). */
  ffmpegPath?: string;
};

/**
 * Extracts the audio track from a video file using FFmpeg.
 *
 * Steps performed:
 * 1. Ensures the output directory exists (creates it if necessary).
 * 2. Removes any existing audio file to avoid conflicts.
 * 3. Invokes FFmpeg to extract the audio stream from the input video.
 * 4. Completes without detailed progress tracking due to fast execution.
 *
 * @param episode - Object containing episode metadata and file paths.
 * @param options - Optional configuration for threads, codec, format, and FFmpeg path.
 * @returns A Promise that resolves on successful extraction or rejects on error.
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
    operationStatus.printMessage("Extracting audio from video...");

    const audioPath = path.join(
      "temp",
      "audio",
      `${episode.id}.${audioExtension}`,
    );
    const audioDir = path.dirname(audioPath);

    // Ensure the audio output directory exists
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // Remove existing file to avoid permission or overwrite conflicts
    if (fs.existsSync(audioPath)) {
      fs.rmSync(audioPath, { force: true });
    }

    const args: string[] = ["-y"];

    // Apply thread configuration if provided
    if (threads) args.push("-threads", threads.toString());

    args.push(
      "-i",
      episode.inputPath,
      "-vn", // Disable video stream processing
      "-acodec",
      audioCodec,
      audioPath,
    );

    const ff = spawn(ffmpegPath, args);

    /**
     * Audio extraction (especially using "copy") is typically near-instant,
     * so no detailed progress parsing is required.
     */

    ff.on("close", (code) => {
      if (code === 0) {
        operationStatus.printCompleteMessage(0);
        resolve();
      } else {
        operationStatus.printErrorMessage(() => {
          reject(
            new Error(
              `Failed to extract audio: FFmpeg exited with code ${code}`,
            ),
          );
        });
      }
    });

    ff.on("error", (error) => {
      reject(
        new Error(
          `Failed to start FFmpeg process for audio extraction: ${error.message}`,
        ),
      );
    });
  });
}
