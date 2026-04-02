import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Configurações para a leitura e mapeamento dos episódios na pasta de entrada.
 */
export type GetEpisodesArgs = {
  /** Diretório onde os vídeos originais estão localizados. Padrão: "inputs". */
  inputDir?: string;
  /** Diretório onde os vídeos processados serão salvos. Padrão: "outputs". */
  outputDir?: string;
  /** Extensões de vídeo permitidas. Padrão: [".mp4", ".mkv"]. */
  allowedExtensions?: string[];
  /** Sufixo adicionado ao nome do arquivo final. Padrão: "_4k". */
  outputSuffix?: string;
};

/**
 * Lê a pasta de entradas, extrai os metadados de cada vídeo usando ffprobe
 * e retorna um array com a fila de episódios prontos para processamento.
 *
 * @param options Configurações de diretórios e extensões.
 * @returns Array de objetos Episode validados.
 */
export function getEpisodes({
  inputDir = "inputs",
  outputDir = "outputs",
  allowedExtensions = [".mp4", ".mkv"],
  outputSuffix = "_4k",
}: GetEpisodesArgs = {}): Episode[] {
  const operationStatus = new OperationStatus("Scanner");

  // Garante que a pasta de entrada exista
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
    operationStatus.printMessage(
      `📂 Pasta '${inputDir}' criada. Coloque seus vídeos lá e rode o script novamente.`,
    );
    return [];
  }

  // Lê os arquivos e filtra apenas as extensões permitidas
  const files = fs.readdirSync(inputDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return allowedExtensions.includes(ext);
  });

  if (files.length === 0) {
    operationStatus.printMessage(
      `Nenhum vídeo compatível encontrado na pasta '${inputDir}'.`,
    );
    return [];
  }

  operationStatus.printMessage(
    `🔍 Analisando metadados de ${files.length} arquivo(s)...`,
  );

  const episodes: Episode[] = [];

  for (const [index, file] of files.entries()) {
    const inputPath = path.join(inputDir, file);
    const parsedFile = path.parse(file);

    // Constrói o caminho de saída com o sufixo (ex: inputs/Naruto.mp4 -> outputs/Naruto_4k.mp4)
    const outputPath = path.join(
      outputDir,
      `${parsedFile.name}${outputSuffix}${parsedFile.ext}`,
    );

    try {
      // ffprobe: extrai duração, frames e framerate no formato JSON
      const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=duration,nb_frames,r_frame_rate -of json "${inputPath}"`;

      const stdout = execSync(cmd).toString();
      const data = JSON.parse(stdout).streams[0];

      if (!data) {
        throw new Error("Nenhum stream de vídeo encontrado no arquivo.");
      }

      const duration = parseFloat(data.duration);

      // Cálculo do framerate
      const [num, den] = data.r_frame_rate.split("/").map(Number);
      const framerate = num / den;

      // Resgate (Fallback): Calcula os frames caso o ffprobe não reporte
      let frames = parseInt(data.nb_frames || "0", 10);
      if (frames === 0 || isNaN(frames)) {
        frames = Math.round(duration * framerate);
      }

      // Adiciona na fila de episódios
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
      // Passamos () => {} pois não estamos rejeitando uma Promise
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      operationStatus.printErrorMessage(
        () => {},
        `Ignorando '${file}': Falha ao ler metadados com ffprobe. Erro: ${errorMessage}`,
      );
      continue;
    }
  }

  // Log de sucesso informando quantos entraram na fila
  if (episodes.length > 0) {
    operationStatus.printMessage(
      `✅ ${episodes.length} vídeo(s) lido(s) e na fila para processamento.`,
    );
  }

  return episodes;
}
