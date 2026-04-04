import { getEpisodes } from "./getEpisodes";
import { extractFrames } from "./extractFrames";
import { upscaleFrames } from "./upscaleFrames";
import { encodeEpisode } from "./encodeEpisode";
import { cleanEpisodeTemp } from "./cleanEpisodeTemp";
import OperationStatus from "./utils/OperationStatus";
import { extractAudio } from "./extractAudio";

/**
 * Função principal que gerencia a fila de processamento de vídeos.
 * Ordem do pipeline: Leitura -> Extração -> Upscale -> Encode -> Limpeza.
 */
async function processQueue() {
  const queueStatus = new OperationStatus("Pipeline");
  const globalStartTime = Date.now();

  // 1. Obtém os vídeos da pasta
  const episodes = getEpisodes();

  // Se a pasta estiver vazia, encerra o script sem fazer nada
  if (episodes.length === 0) {
    queueStatus.printMessage("Fila vazia. Encerrando pipeline.");
    return;
  }

  // O for...of respeita o await e pausa a execução até cada Promise resolver
  for (const [index, ep] of episodes.entries()) {
    const epStartTime = Date.now();

    try {
      // Exibe: [Pipeline] ▶ Iniciando processamento (1/5): Naruto_Ep01
      queueStatus.printMessage(
        `\n▶ Iniciando processamento (${index + 1}/${episodes.length}): ${ep.name}`,
      );

      await extractFrames(ep);
      await extractAudio(ep);
      await upscaleFrames(ep, { scale: 1 });
      await encodeEpisode(ep);
      cleanEpisodeTemp(ep);

      const epTotalTimeSec = (Date.now() - epStartTime) / 1000;
      queueStatus.printMessage(
        `✅ Episódio '${ep.name}' concluído com sucesso em ${(epTotalTimeSec / 60).toFixed(1)} minutos.`,
      );
    } catch (error) {
      // O try/catch garante que, se um vídeo corrompido quebrar no FFmpeg,
      // o script pula para o próximo sem derrubar a fila inteira.
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      queueStatus.printErrorMessage(
        () => {},
        `Erro ao processar '${ep.name}'. Pulando para o próximo. Erro: ${errorMessage}`,
      );
    }
  }

  // Calcula o tempo total de todos os episódios somados
  const globalTotalTimeSec = (Date.now() - globalStartTime) / 1000;

  queueStatus.printMessage("\n=============================================");
  queueStatus.printCompleteMessage(globalTotalTimeSec);
  queueStatus.printMessage("🎉 Todos os episódios da fila foram processados!");
  queueStatus.printMessage("=============================================\n");
}

// Inicia a execução
processQueue();
