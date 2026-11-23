export const OFFLINE = "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
export const INVALID_RESPONSE = "Não foi possível ler a resposta do servidor. Tente de novo.";
export const UNEXPECTED = "O servidor não conseguiu atender o pedido. Tente de novo em instantes.";

export class ApiError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
