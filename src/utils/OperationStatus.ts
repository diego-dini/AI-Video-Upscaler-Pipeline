import type { Episode } from "../types/Episode";
import "dotenv/config";

/**
 * Converte segundos em uma string formatada (minutos e segundos).
 * Garante que os segundos tenham sempre 2 dígitos para manter o alinhamento visual no terminal.
 *
 * @param seconds Tempo em segundos
 * @returns String no formato "Xm YYs" (ex: "5m 09s")
 */
const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return "0m 00s"; // Prevenção de NaN ou negativos

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  // padStart garante que números menores que 10 fiquem com um zero na frente (ex: 09)
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

/**
 * Gerencia o log de status de operações (extração, upscaling, encoding etc.) no terminal.
 */
class OperationStatus {
  private readonly operation: string;
  private readonly isVerbose: boolean;

  /**
   * @param operation Nome da operação atual (ex: "Extract", "Upscale", "Encode").
   */
  constructor(operation: string) {
    this.operation = operation;
    // Avalia o modo verbose apenas uma vez na criação da instância, poupando CPU
    this.isVerbose = process.env.VERBOSE !== "false";
  }

  /**
   * Exibe uma mensagem de log padrão no terminal.
   */
  printMessage(message: string): void {
    if (!this.isVerbose) return;
    // Adiciona o contexto da operação para facilitar a leitura do log
    console.log(`[${this.operation}] ${message}`);
  }

  /**
   * Atualiza o progresso da operação sobrescrevendo a mesma linha no terminal.
   */
  updateStatus(
    episode: Episode,
    frame: number,
    total: number,
    percent: string,
    elapsedSec: number,
    etaSec: number,
  ): void {
    if (!this.isVerbose) return;

    const logText = `${episode.name} | [${this.operation}] Frame: ${frame}/${total} | ${percent}% | Tempo: ${formatTime(elapsedSec)} | ETA: ${formatTime(etaSec)}`;

    // \r volta o cursor para o início da linha.
    // \x1b[K (Escape Sequence ANSI) limpa o restante da linha, evitando "sujeira" visual
    // se a string atual for menor que a string anterior.
    process.stdout.write(`\r\x1b[K${logText}`);
  }

  /**
   * Exibe mensagem de conclusão ao término da operação.
   *
   * @param totalTime Tempo total da operação em segundos (0 se não for aplicável)
   */
  printCompleteMessage(totalTime: number): void {
    if (!this.isVerbose) return;

    const timeInfo =
      totalTime > 0 ? ` (Tempo total: ${formatTime(totalTime)})` : "";
    console.log(`\n✅ [${this.operation}] Finalizado com sucesso!${timeInfo}`);
  }

  /**
   * Exibe uma mensagem de erro visual no terminal e executa um callback de rejeição.
   *
   * @param reject Callback que rejeita a Promise (normalmente reject ou throw Error)
   * @param errorMsg Mensagem opcional de erro para printar
   */
  printErrorMessage(reject: () => void, errorMsg?: string): void {
    console.error(
      `\n❌ [${this.operation}] Falha na operação.${errorMsg ? ` Detalhes: ${errorMsg}` : ""}`,
    );
    reject();
  }
}

export default OperationStatus;
