import { error } from "console";
import type { Episode } from "../types/Episode";

//TODO IMPLEMENTAR CLASSE OPERATION STATUS COM FUNÇÔES MAIS DIRETAS

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

function update(
  episode: Episode,
  frame: number,
  total: number,
  percent: string,
  elapsedSec: number,
  etaSec: number,
) {
  process.stdout.write(
    `\r${episode.name}: ` +
      `Encode: ${frame}/${total} | ${percent}% | ` +
      `Tempo: ${formatTime(elapsedSec)} | ETA: ${formatTime(etaSec)}`,
  );
}

function complete(totalTime: number) {
  console.log(`\n✅ Vídeo finalizado! Tempo total: ${formatTime(totalTime)}`);
}

const OperationStatus = { update, complete, error };

export default OperationStatus;
