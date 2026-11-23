const MAX_TARGET_DATES = 31;

export function validateCopyTargets(sourceDate: string, targetDates: string[], today: string): string | null {
  if (targetDates.length === 0) return "Adicione ao menos uma data de destino.";
  if (targetDates.length > MAX_TARGET_DATES) return "Escolha no máximo 31 datas.";
  if (targetDates.some((date) => date <= today)) return "Escolha somente datas futuras.";
  if (new Set(targetDates).size !== targetDates.length || targetDates.includes(sourceDate)) {
    return "As datas de destino devem ser únicas e diferentes da origem.";
  }
  return null;
}
