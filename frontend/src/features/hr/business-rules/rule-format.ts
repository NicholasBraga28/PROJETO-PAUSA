import type { BusinessRuleType } from "./api";

const INPUT_TYPE: Record<BusinessRuleType, "number" | "time" | "text"> = {
  MINUTES: "number",
  DAYS: "number",
  COUNT: "number",
  TIME_OF_DAY: "time",
  WEEKDAYS: "text",
};

const UNIT: Record<BusinessRuleType, string> = {
  MINUTES: "minutos",
  DAYS: "dias",
  COUNT: "unidades",
  TIME_OF_DAY: "horário local",
  WEEKDAYS: "dias da semana",
};

const TYPE_LABEL: Record<BusinessRuleType, string> = {
  MINUTES: "minutos",
  DAYS: "dias",
  COUNT: "quantidade",
  TIME_OF_DAY: "horário do dia",
  WEEKDAYS: "dias da semana",
};

const RULE_LABELS: Record<string, string> = {
  BOOKING_MIN_NOTICE_MINUTES: "Antecedência mínima para agendar",
  CANCELLATION_MIN_NOTICE_MINUTES: "Antecedência mínima para cancelar",
  LATE_ARRIVAL_TOLERANCE_MINUTES: "Tolerância de atraso",
  CHECK_IN_EARLY_MINUTES: "Antecedência máxima do check-in",
  REMINDER_LEAD_MINUTES: "Antecedência do lembrete",
  REMINDER_CONFIRMATION_TOLERANCE_MINUTES: "Prazo para confirmar após o lembrete",
  WAITLIST_ACCEPTANCE_MINUTES: "Prazo para aceitar vaga da lista de espera",
  SESSION_DURATION_MINUTES: "Duração da sessão",
  SLOT_STEP_MINUTES: "Intervalo entre horários",
  BOOKING_HORIZON_DAYS: "Janela de agendamento",
  MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE: "Limite de reservas por colaborador",
  WORK_DAYS: "Dias de funcionamento",
  WORK_START: "Início do expediente",
  LUNCH_START: "Início do almoço",
  LUNCH_END: "Fim do almoço",
  WORK_END: "Fim do expediente",
};

export const inputTypeFor = (type: BusinessRuleType) => INPUT_TYPE[type];
export const unitFor = (type: BusinessRuleType) => UNIT[type];
export const typeLabelFor = (type: BusinessRuleType) => TYPE_LABEL[type];
export const labelFor = (key: string) => RULE_LABELS[key] ?? "Configuração de atendimento";

export function formatRuleValue(value: string, type: BusinessRuleType): string {
  const unit = unitFor(type);
  return unit ? `${value} ${unit}` : value;
}

export function inputHint(type: BusinessRuleType): string {
  if (type === "MINUTES") return "Informe o total de minutos. Vamos conferir o valor antes de salvar.";
  if (type === "DAYS") return "Informe o total de dias. Vamos conferir o valor antes de salvar.";
  if (type === "COUNT") return "Informe a quantidade. Vamos conferir o valor antes de salvar.";
  if (type === "TIME_OF_DAY") return "Informe um horário válido, no formato HH:MM.";
  return "Informe os dias da semana separados por vírgula, usando 1 para segunda e 7 para domingo.";
}
