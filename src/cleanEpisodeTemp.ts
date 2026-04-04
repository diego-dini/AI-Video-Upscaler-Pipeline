import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Removes temporary artifacts (files and directories) for a given episode after processing.
 *
 * Cleaned items:
 * - temp/frames/{episode.id}
 * - temp/framesUpscaled/{episode.id}
 * - temp/audio/{episode.id}.aac
 * - temp/audio/{episode.id}.m4a
 *
 * @param episode Object containing episode metadata.
 */
export function cleanEpisodeTemp(episode: Episode): void {
  // Initialize the operation status handler with the operation name
  const operationStatus = new OperationStatus("Cleanup");

  const id = String(episode.id);

  // Centralized list of all paths that should be removed
  const pathsToRemove = [
    path.join("temp", "frames", id),
    path.join("temp", "framesUpscaled", id),
    path.join("temp", "audio", `${id}.aac`),
    path.join("temp", "audio", `${id}.m4a`),
  ];

  try {
    // Remove each file/directory from the list
    for (const targetPath of pathsToRemove) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Use OperationStatus to print a standardized success message
    operationStatus.printMessage(
      `Temporary files for episode "${episode.name}" (ID: ${id}) were successfully cleaned.`,
    );
  } catch (error) {
    // Error handling (e.g., locked files on Windows)
    // Passing () => {} since this is not inside a Promise context
    const errorMessage = error instanceof Error ? error.message : String(error);

    operationStatus.printErrorMessage(
      () => {},
      `Failed to clean all temporary files. Error: ${errorMessage}`,
    );
  }
}
