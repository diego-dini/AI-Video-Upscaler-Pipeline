/**
 * Representa os metadados e os caminhos de arquivo de um episódio
 * que passará pelo fluxo de processamento (Extração -> Upscale -> Encode).
 */
export type Episode = {
  /**
   * Identificador único do episódio (pode ser um número em string, UUID, etc.).
   * Usado para criar as pastas temporárias de frames e áudio.
   */
  readonly id: string;

  /**
   * Nome de exibição do episódio (ex: "Naruto_Ep01").
   * Usado principalmente para os logs no terminal.
   */
  readonly name: string;

  /**
   * Duração total do vídeo original em segundos.
   */
  readonly duration: number;

  /**
   * Quantidade total de frames extraídos/esperados.
   * Usado para calcular a porcentagem de progresso e o ETA (Tempo Restante).
   */
  readonly frames: number;

  /**
   * Taxa de quadros por segundo (FPS) do vídeo original (ex: 23.976, 24, 30).
   * Essencial para que o FFmpeg recrie o vídeo final na mesma velocidade, evitando perda de sincronia de áudio.
   */
  readonly framerate: number;

  /**
   * Caminho completo (absoluto ou relativo) do arquivo de vídeo original.
   * Ex: "C:\animes\naruto_ep1_480p.mkv"
   */
  readonly inputPath: string;

  /**
   * Caminho completo (absoluto ou relativo) onde o vídeo finalizado (upscaled) será salvo.
   * Ex: "C:\animes\upscaled\naruto_ep1_1080p.mkv"
   */
  readonly outputPath: string;
};
