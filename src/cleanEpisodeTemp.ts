import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";

//TODO PADRONIZAR NOMES DE VARIAVEIS UTILIZADAS NO OPERATION STATUS

export function cleanEpisodeTemp(episode: Episode) {
  const id = String(episode.id);

  const framesDir = path.join("temp", "frames", id);
  const upscaledDir = path.join("temp", "framesUpscaled", id);
  const audioPathAac = path.join("temp", "audio", `${id}.aac`);
  const audioPathM4a = path.join("temp", "audio", `${id}.m4a`);

  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  if (fs.existsSync(upscaledDir)) {
    fs.rmSync(upscaledDir, { recursive: true, force: true });
  }

  if (fs.existsSync(audioPathAac)) {
    fs.rmSync(audioPathAac, { force: true });
  }

  if (fs.existsSync(audioPathM4a)) {
    fs.rmSync(audioPathM4a, { force: true });
  }

  console.log(`🧹 Temp do episódio ${episode.name} (${id}) limpo`);
}
