import fs from "fs";
import path from "path";
import type { Episode } from "./types/Episode";
import OperationStatus from "./utils/OperationStatus";

/**
 * Remove artefatos temporários (arquivos e pastas) de um episódio após o processamento.
 *
 * Itens limpos:
 * - temp/frames/{episode.id}
 * - temp/framesUpscaled/{episode.id}
 * - temp/audio/{episode.id}.aac
 * - temp/audio/{episode.id}.m4a
 *
 * @param episode Objeto contendo os metadados do episódio.
 */
export function cleanEpisodeTemp(episode: Episode): void {
  // Instancia o gerenciador de status com o nome da operação
  const operationStatus = new OperationStatus("Cleanup");

  const id = String(episode.id);

  // Lista centralizada de todos os caminhos que devem ser apagados.
  const pathsToRemove = [
    path.join("temp", "frames", id),
    path.join("temp", "framesUpscaled", id),
    path.join("temp", "audio", `${id}.aac`),
    path.join("temp", "audio", `${id}.m4a`),
  ];

  try {
    // Apaga cada arquivo/pasta da lista
    for (const targetPath of pathsToRemove) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Usa o OperationStatus para printar o sucesso de forma padronizada
    operationStatus.printMessage(
      `🧹 Temp do episódio ${episode.name} (ID: ${id}) limpo com sucesso.`,
    );
  } catch (error) {
    // Caso de erro (ex: arquivo travado no Windows).
    // Passamos () => {} pois não estamos em uma Promise para dar reject().
    const errorMessage = error instanceof Error ? error.message : String(error);

    operationStatus.printErrorMessage(
      () => {},
      `Não foi possível limpar todos os arquivos. Erro: ${errorMessage}`,
    );
  }
}
