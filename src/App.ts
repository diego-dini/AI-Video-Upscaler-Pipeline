import { getEpisodes } from "./GetEpisodes";
import { extractFrames } from "./ExtractFrames";
import { upscaleFrames } from "./UpscaleFrames";
import { encodeEpisode } from "./EncondeEpisode";
import { cleanEpisodeTemp } from "./cleanEpisodeTemp";

// Envolvemos tudo em uma função assíncrona
async function processQueue() {
  const episodes = getEpisodes();
  console.log("Episódios na fila:", episodes);

  // O for...of respeita o await e pausa a execução até a Promise resolver
  for (const ep of episodes) {
    try {
      console.log(`\n▶ Iniciando processamento do episódio: ${ep.name}`);

      await extractFrames(ep);
      await upscaleFrames(ep, { scale: 4 });
      await encodeEpisode(ep);
      await cleanEpisodeTemp(ep);
      console.log(`✅ Episódio ${ep} finalizado com sucesso!`);
    } catch (error) {
      // O try/catch é importante em filas para que, se um episódio falhar,
      // não trave ou cancele o processamento dos próximos episódios.
      console.error(`❌ Erro ao processar o episódio ${ep.name}:`);
      console.error(error);
    }
  }

  console.log("\n🎉 Todos os episódios foram processados!");
}

// Inicia a fila
processQueue();
