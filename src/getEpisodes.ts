import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configuration options for scanning and mapping episodes from the input directory.
 */
export type GetEpisodesArgs = {
  /** Directory where source videos are located. Default: "inputs". */
  inputDir?: string;
  /** Directory where processed videos will be saved. Default: "outputs". */
  outputDir?: string;
  /** Allowed video file extensions. Default: [".mp4", ".mkv"]. */
  allowedExtensions?: string[];
  /** Suffix appended to the output filename. Default: "_4k". */
  outputSuffix?: string;
};

/**
 * Reads the input directory, extracts metadata for each video using ffprobe,
 * and returns an array of validated Episode objects ready for processing.
 *
 * Steps performed:
 * 1. Ensures the input directory exists (creates it if necessary).
 * 2. Filters files based on allowed extensions.
 * 3. Extracts metadata (duration, frame count, framerate) using ffprobe.
 * 4. Applies fallback logic when frame count is unavailable.
 * 5. Builds and returns a processing queue of Episode objects.
 *
 * @param options - Configuration for directories, extensions, and naming.
 * @returns Array of Episode objects ready for processing.
 */
export function getEpisodes({
  inputDir = "inputs",
  outputDir = "outputs",
  allowedExtensions = [".mp4", ".mkv"],
  outputSuffix = "_4k",
}: GetEpisodesArgs = {}): Episode[] {
  const operationStatus = new OperationStatus("Scanner");

  // Ensure input directory exists
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
    operationStatus.printMessage(
      `Input directory '${inputDir}' was created. Place your videos there and run the process again.`,
    );
    return [];
  }

  // Read files and filter by allowed extensions
  const files = fs.readdirSync(inputDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return allowedExtensions.includes(ext);
  });

  // Handle case where no valid files are found
  if (files.length === 0) {
    operationStatus.printMessage(
      `No compatible video files found in directory '${inputDir}'.`,
    );
    return [];
  }

  operationStatus.printMessage(
    `Analyzing metadata for ${files.length} file(s)...`,
  );

  const episodes: Episode[] = [];

  for (const [index, file] of files.entries()) {
    const inputPath = path.join(inputDir, file);
    const parsedFile = path.parse(file);

    // Build output path with suffix (e.g., inputs/video.mp4 -> outputs/video_4k.mp4)
    const outputPath = path.join(
      outputDir,
      `${parsedFile.name}${outputSuffix}${parsedFile.ext}`,
    );

    try {
      // ffprobe command to extract duration, frame count, and framerate in JSON format
      const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=duration,nb_frames,r_frame_rate -of json "${inputPath}"`;

      const stdout = execSync(cmd).toString();
      const data = JSON.parse(stdout).streams[0];

      if (!data) {
        throw new Error("No video stream found in file.");
      }

      const duration = parseFloat(data.duration);

      // Calculate framerate
      const [num, den] = data.r_frame_rate.split("/").map(Number);
      const framerate = num / den;

      // Fallback: estimate frame count if not provided by ffprobe
      let frames = parseInt(data.nb_frames || "0", 10);
      if (frames === 0 || isNaN(frames)) {
        frames = Math.round(duration * framerate);
      }

      // Add episode to processing queue
      episodes.push({
        id: `${Date.now()}_${index}`,
        name: parsedFile.name,
        duration,
        frames,
        framerate,
        inputPath,
        outputPath,
      });
    } catch (error) {
      // Handle metadata extraction failure and skip file
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      operationStatus.printErrorMessage(
        () => {},
        `Skipping '${file}': Failed to read metadata using ffprobe. Error: ${errorMessage}`,
      );

      continue;
    }
  }

  // Log success if at least one episode was queued
  if (episodes.length > 0) {
    operationStatus.printMessage(
      `${episodes.length} video(s) successfully loaded into the processing queue.`,
    );
  }

  return episodes;
}
