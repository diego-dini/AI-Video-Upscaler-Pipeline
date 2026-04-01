import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";

export function getEpisodes(): Episode[] {
  const files = fs.readdirSync("inputs").filter(f => f.endsWith(".mp4"));

  return files.map((file, index) => {
    const inputPath = `./inputs/${file}`;
    const outputPath = `./outputs/${path.parse(file).name}_4k.mp4`;

    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=duration,nb_frames,r_frame_rate -of json "${inputPath}"`;
    const data = JSON.parse(execSync(cmd).toString()).streams[0];

    const duration = parseFloat(data.duration);
    const frames = parseInt(data.nb_frames || "0");

    const [num, den] = data.r_frame_rate.split("/").map(Number);
    const framerate = num / den;

    return {
      id: Date.now().toString() +  index.toString(),
      name: file,
      duration,
      frames,
      framerate,
      inputPath,
      outputPath
    };
  });
}