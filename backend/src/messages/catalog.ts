export const messages = {
  feedback: {
    submitted: "Obrigado por compartilhar sua experiência.",
  },
  errors: {
    notIdentified: "Você ainda não se identificou: escolha um usuário na tela de entrada.",
    identificationNotRecognized:
      "Não encontramos um usuário ativo com essa identificação: escolha um usuário na tela de entrada.",
    accessDenied: "Seu perfil não tem acesso a esta função: volte para a página inicial.",
    invalidPeriod: "O período informado é inválido.",
    invalidReportPeriod: "O período do relatório é inválido. Confira as datas e tente novamente.",
    invalidReportFilter: "Os filtros do relatório são inválidos. Confira as informações e tente novamente.",
    invalidAuditCursor: "Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente.",
    locationNotFound: "A unidade selecionada não foi encontrada. Confira a unidade e tente novamente.",
    invalidDuration: "A duração informada é inválida.",
    outsideOperatingHours: "O período está fora do funcionamento ou coincide com o almoço.",
    outsideBookingHorizon: "O período está fora da janela de agendamento.",
    activeBookingLimit: "Você já tem o máximo de reservas futuras. Cancele uma para agendar outra.",
    invalidRoom: "A sala informada não está ativa ou não pertence à disponibilidade.",
    checkInTooEarly: "O check-in ainda não está disponível.",
    noAppointmentForRoom: "Não há uma reserva elegível para este colaborador nesta sala.",
    bookingNotice: "A antecedência mínima para agendamento não foi respeitada.",
    cancellationNotice: "A antecedência mínima para cancelamento não foi respeitada.",
    lateCheckIn: "O limite de atraso para check-in foi excedido.",
    outsideAvailability: "O período não pertence à disponibilidade do massoterapeuta.",
    unavailable: "O horário não está disponível.",
    appointmentNotFound: "Agendamento não encontrado.",
    appointmentCannotCancel: "O agendamento não pode mais ser cancelado.",
    invalidCheckIn: "Código de check-in inválido.",
    checkInUnavailable: "Check-in indisponível para este agendamento.",
    userNotFound: "Usuário não encontrado: atualize a lista e tente novamente.",
    userEmailAlreadyExists: "Já existe um usuário cadastrado com este e-mail.",
    therapistNotFound: "Massoterapeuta não encontrado.",
    therapistInactive: "O massoterapeuta selecionado está inativo.",
    roomNotFound: "Sala não encontrada.",
    roomNameAlreadyExists: "Já existe uma sala com este nome nesta unidade: escolha outro nome.",
    roomInactive: "A sala selecionada está inativa.",
    scheduleNotFound: "Período de agenda não encontrado.",
    scheduleConflictTherapist: "O massoterapeuta já possui outro período de trabalho neste mesmo horário.",
    scheduleConflictRoom: "A sala selecionada já está ocupada por outro período neste mesmo horário.",
    scheduleHasAppointments:
      "Não é possível alterar ou remover este período pois já existem atendimentos agendados nele.",
    scheduleCopyEmptySource: "Não há períodos na data de origem para copiar: escolha outra data.",
    scheduleCopyInvalidTargets:
      "As datas de destino precisam ser futuras, diferentes da data de origem e sem repetição.",
    scheduleBlockInPast: "O início do bloqueio já passou: escolha um horário a partir de agora.",
    scheduleBlockSpansDays: "O bloqueio precisa começar e terminar no mesmo dia: crie um bloqueio para cada dia.",
    scheduleBlockOutsideOperatingHours: "O bloqueio precisa ficar num dia útil, dentro do horário de funcionamento.",
    scheduleAlreadyBlocked: "Esse período já está bloqueado.",
    scheduleBlockHasAppointments: (count: string, atTime: string, isSingle: boolean) =>
      isSingle
        ? `Há ${count} nesse período, ${atTime}. Cancele-o antes de bloquear.`
        : `Há ${count} nesse período, o primeiro ${atTime}. Cancele-os antes de bloquear.`,
    therapistProfileNotFound: "Perfil de massoterapeuta não encontrado.",
    therapistProfileUnavailable: "Seu usuário não tem um perfil de massoterapeuta ativo: procure o RH.",
    invalidAgendaDate: "A data da agenda é inválida: informe o dia no formato ano-mês-dia.",
    invalidNotificationsSince: "O instante dos avisos é inválido: informe a data e a hora completas.",
    notificationNotFound: "Aviso não encontrado.",
    sessionNotOpenYet: "Este atendimento ainda não pode ser iniciado.",
    sessionTimeOver: "O horário deste atendimento já terminou.",
    anotherSessionInProgress: (firstName: string) => `Finalize a sessão com ${firstName} antes de iniciar outra.`,
    noAppointmentToStart: "Não há atendimento para iniciar agora.",
    noSessionInProgress: "Nenhuma sessão em andamento.",
    stillWithinLateTolerance: "Ainda está dentro da tolerância de atraso.",
    appointmentChangedMeanwhile: "Este atendimento acabou de mudar: consulte a agenda e tente de novo.",
    invalidStatusTransition:
      "Esta ação não está disponível para este atendimento agora. Consulte a agenda para ver a situação dele.",
    waitlistEntryNotFound: "Entrada da lista de espera não encontrada.",
    waitlistAlreadyJoined: "Você já está na lista de espera para este horário.",
    waitlistOfferExpired: "A oferta da vaga expirou.",
    waitlistOfferUnavailable: "A vaga já foi aceita por outra pessoa ou não está mais disponível.",
    businessRuleNotFound: "Parâmetro de regra de negócio não encontrado: atualize a lista e tente novamente.",
    invalidBusinessRuleValue: "O valor informado para esta regra de negócio é inválido ou fora dos limites permitidos.",
  },
  businessRules: {
    units: { MINUTES: "minutos", DAYS: "dias", COUNT: "", TIME_OF_DAY: "", WEEKDAYS: "" },
    violations: {
      MISSING: (label: string) => `Informe ${label}.`,
      NOT_NON_NEGATIVE_INTEGER: (subject: string) => `${subject} deve ser um número inteiro igual ou maior que zero.`,
      NOT_POSITIVE: (subject: string) => `${subject} deve ser um número inteiro maior que zero.`,
      NOT_TIME_OF_DAY: (subject: string) => `${subject} deve estar no formato HH:MM, por exemplo 09:00.`,
      OUTSIDE_DAY: (subject: string) => `${subject} deve ser um horário entre 00:00 e 23:59.`,
      NOT_WEEKDAYS: (subject: string) => `${subject} devem ir de 1 (segunda) a 7 (domingo), por exemplo 1,2,3,4,5.`,
      OUT_OF_LIMITS: (subject: string, min: number, max: number, unit: string) =>
        `${subject} deve ficar entre ${min} e ${[max, unit].filter(Boolean).join(" ")}.`,
      NOT_AFTER: (subject: string, ofOther: string) => `${subject} deve ser depois ${ofOther}.`,
      NOT_BEFORE: (subject: string, ofOther: string) => `${subject} deve ser antes ${ofOther}.`,
      BEFORE: (subject: string, ofOther: string) => `${subject} não pode ser antes ${ofOther}.`,
    },
    parameters: {
      bookingMinNoticeMinutes: {
        label: "a antecedência mínima para agendar",
        description: "Antecedência mínima, em minutos, para o colaborador agendar uma sessão.",
      },
      cancellationMinNoticeMinutes: {
        label: "a antecedência mínima para cancelar",
        description: "Antecedência mínima, em minutos, para cancelar uma sessão.",
      },
      lateArrivalToleranceMinutes: {
        label: "a tolerância de atraso",
        description: "Minutos de atraso aceitos no check-in; depois disso, a sessão pode virar ausência.",
      },
      checkInEarlyMinutes: {
        label: "a antecedência máxima do check-in",
        description: "Quantos minutos antes do início da sessão o check-in fica disponível.",
      },
      reminderLeadMinutes: {
        label: "a antecedência do lembrete",
        description: "Quantos minutos antes da sessão o colaborador recebe o lembrete.",
      },
      reminderConfirmationToleranceMinutes: {
        label: "o prazo para confirmar depois do lembrete",
        description: "Minutos que o colaborador tem para confirmar a sessão depois do lembrete.",
      },
      waitlistAcceptanceMinutes: {
        label: "o prazo para aceitar a vaga da lista de espera",
        description: "Minutos que a pessoa da lista de espera tem para aceitar uma vaga liberada.",
      },
      sessionDurationMinutes: {
        label: "a duração da sessão",
        description: "Duração de cada sessão, em minutos.",
      },
      slotStepMinutes: {
        label: "o intervalo entre horários",
        description: "Minutos entre o início de um horário disponível e o início do seguinte.",
      },
      bookingHorizonDays: {
        label: "a janela de agendamento",
        description: "Até quantos dias à frente o colaborador pode agendar.",
      },
      maxActiveBookingsPerEmployee: {
        label: "o limite de reservas por colaborador",
        description: "Quantas reservas futuras ativas cada colaborador pode ter ao mesmo tempo.",
      },
      workDays: {
        label: "os dias de funcionamento",
        description: "Dias da semana com atendimento, de 1 (segunda) a 7 (domingo), separados por vírgula.",
      },
      workStartMinutes: {
        label: "o início do expediente",
        description: "Horário de início do atendimento, no formato HH:MM.",
      },
      lunchStartMinutes: {
        label: "o início do almoço",
        description: "Horário de início do almoço, no formato HH:MM; igual ao fim do almoço quando não há pausa.",
      },
      lunchEndMinutes: {
        label: "o fim do almoço",
        description: "Horário de fim do almoço, no formato HH:MM.",
      },
      workEndMinutes: {
        label: "o fim do expediente",
        description: "Horário de fim do atendimento, no formato HH:MM.",
      },
    },
  },
  roles: {
    spoken: {
      EMPLOYEE: "colaborador",
      THERAPIST: "massoterapeuta",
      HR: "RH",
      ADMIN: "suporte",
    },
  },
  profile: {
    signedInAs: (firstName: string, spokenRole: string) => `Você entrou como ${firstName}, ${spokenRole}.`,
  },
  demoUsers: {
    spokenItem: (name: string, spokenRole: string) => `${name}, ${spokenRole}.`,
  },
  availability: {
    noSlots: "Não há horários disponíveis.",
    summary: (count: number, firstName: string, hour: string) =>
      `Há ${count} ${count === 1 ? "horário disponível" : "horários disponíveis"}. Primeiro: ${firstName}, às ${hour}.`,
  },
  chat: {
    unavailable: "O assistente está temporariamente indisponível. Tente novamente em instantes.",
  },
  reports: {
    shiftNames: { MORNING: "manhã", AFTERNOON: "tarde" },
    weekdayNames: {
      MONDAY: "segunda-feira",
      TUESDAY: "terça-feira",
      WEDNESDAY: "quarta-feira",
      THURSDAY: "quinta-feira",
      FRIDAY: "sexta-feira",
      SATURDAY: "sábado",
      SUNDAY: "domingo",
    },
    period: (from: string, to: string) => `Período de ${from} a ${to}`,
    shiftSummary: (shift: string, count: number) => `Turno mais procurado: ${shift}, com ${count} agendamentos`,
    weekdaySummary: (weekday: string, count: number) => `Dia com maior volume: ${weekday}, com ${count} agendamentos`,
    startTimeSummary: (time: string, count: number) => `Horário mais procurado: ${time}, com ${count} agendamentos`,
    noShiftDemand: "Sem procura registrada por turno",
    noWeekdayDemand: "Sem procura registrada por dia da semana",
    noStartTimeDemand: "Sem procura registrada por horário",
    cancellationSummary: (cancelled: number, scheduled: number, rate: string) =>
      `Cancelamentos: ${cancelled} de ${scheduled} agendamentos, taxa de ${rate}%`,
    noCancellations: "Não há agendamentos no período para calcular cancelamentos",
    kpiSummary: (period: string, shift: string, weekday: string, startTime: string, cancellations: string) =>
      `${period}. ${shift}. ${weekday}. ${startTime}. ${cancellations}.`,
    auditActionNames: {
      appointmentCreated: "Agendamento criado",
      appointmentCancelled: "Agendamento cancelado",
      appointmentCheckedIn: "Check-in registrado",
      sessionStarted: "Sessão iniciada",
      sessionFinished: "Sessão finalizada",
      sessionAutoCompleted: "Sessão finalizada automaticamente",
      appointmentMarkedNoShow: "Ausência registrada pelo massoterapeuta",
    },
    unknownAuditAction: "Evento do agendamento registrado",
    auditEvent: (action: string, dateTime: string, isSystem: boolean) =>
      `${isSystem ? "Evento do sistema: " : ""}${action}, registrado em ${dateTime}.`,
    auditListSummary: (count: number) =>
      count === 0
        ? "Nenhum evento de auditoria no período consultado."
        : `${count} evento${count === 1 ? "" : "s"} de auditoria no período consultado.`,
  },
  booking: {
    confirmed: (therapistName: string, dateTime: string, roomName: string) =>
      `Reserva confirmada para ${dateTime}, com ${therapistName}, na ${roomName}.`,
    cancelled: (therapistName: string, dateTime: string, roomName: string) =>
      `Agendamento cancelado para ${dateTime}, com ${therapistName}, na ${roomName}.`,
  },
  appointments: {
    upcoming: (count: number, therapistName: string, dateTime: string, roomName: string) =>
      `Você tem ${count} ${count === 1 ? "próximo agendamento" : "próximos agendamentos"}. Primeiro: ${therapistName}, ${dateTime}, na ${roomName}.`,
    past: (count: number) => `Você tem ${count} ${count === 1 ? "agendamento anterior" : "agendamentos anteriores"}.`,
    empty: "Você não tem agendamentos.",
  },
  nextAppointment: {
    summary: (therapistName: string, dateTime: string, roomName: string) =>
      `Sua próxima sessão é ${dateTime}, com ${therapistName}, na ${roomName}.`,
    empty: "Você não tem próxima sessão agendada.",
  },
  waitlist: {
    listSummary: (count: number) =>
      count === 0
        ? "Você não tem entradas na lista de espera."
        : `Você tem ${count} ${count === 1 ? "entrada" : "entradas"} na lista de espera.`,
    waiting: (dateTime: string) => `Você está na lista de espera para ${dateTime}.`,
    offer: (dateTime: string, expiresAt: string, therapistName: string, locationName: string) =>
      `Uma vaga ficou disponível para você em ${dateTime}, com ${therapistName}, na unidade ${locationName}. A oferta expira em ${expiresAt}. Acesse Suas sessões para aceitar ou recusar.`,
    converted: (dateTime: string) => `A vaga para ${dateTime} foi confirmada como agendamento.`,
    expired: (dateTime: string) => `A oferta para ${dateTime} expirou.`,
    cancelled: (dateTime: string) => `Sua entrada na lista de espera para ${dateTime} foi cancelada.`,
    declined: (dateTime: string) => `Você recusou a oferta para ${dateTime}.`,
  },
  speech: {
    clockTime: (hour: number, minute: string) => `${hour}h${minute}`,
    atTime: (clockTime: string, isSingularHour: boolean) => `${isSingularHour ? "à" : "às"} ${clockTime}`,
    fromTime: (clockTime: string, isSingularHour: boolean) => `${isSingularHour ? "da" : "das"} ${clockTime}`,
    interval: (fromTime: string, atTime: string) => `${fromTime} ${atTime}`,
    tomorrow: "amanhã",
    onWeekdays: [
      "na segunda-feira",
      "na terça-feira",
      "na quarta-feira",
      "na quinta-feira",
      "na sexta-feira",
      "no sábado",
      "no domingo",
    ],
    months: [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ],
    dayOfMonth: (day: number, isFirstDay: boolean) => (isFirstDay ? `${day}º` : String(day)),
    calendarDate: (dayOfMonth: string, month: string) => `${dayOfMonth} de ${month}`,
    otherDay: (onWeekday: string, dayOfMonth: string, month: string) => `${onWeekday}, ${dayOfMonth} de ${month}`,
    tomorrowAt: (tomorrow: string, atTime: string) => `${tomorrow} ${atTime}`,
    otherDayAt: (otherDay: string, atTime: string) => `${otherDay}, ${atTime}`,
    sentenceEnd: ".",
    count: (count: number, noun: string) => `${count} ${noun}`,
    nouns: {
      appointment: { singular: "atendimento", plural: "atendimentos" },
      person: { singular: "pessoa", plural: "pessoas" },
      notification: { singular: "aviso", plural: "avisos" },
    },
    appointmentStatuses: {
      BOOKED: "reservado",
      CONFIRMED: "confirmado",
      CHECKED_IN: "chegou",
      POSSIBLE_NO_SHOW: "possível ausência",
      IN_PROGRESS: "em andamento",
      COMPLETED: "concluído",
      NO_SHOW: "ausente",
    },
  },
  therapistAgenda: {
    current: (firstName: string, endTime: string) => `Agora: ${firstName}, até ${endTime}`,
    next: (firstName: string, atTime: string) => `Próximo: ${firstName}, ${atTime}`,
    first: (firstName: string, atTime: string) => `Primeiro: ${firstName}, ${atTime}`,
    todaySummary: (count: string) => `Hoje, ${count}`,
    otherDaySummary: (day: string, count: string) => `${day}, ${count}`,
    otherDayEmpty: (day: string) => `${day}, você não tem atendimentos`,
    nothingLeftToday: "Você não tem mais atendimentos hoje.",
    emptyToday: "Você não tem atendimentos hoje.",
    item: (firstName: string, atTime: string, status: string) => `${firstName}, ${atTime}, ${status}`,
    cancelConfirmation: (firstName: string, atTime: string) =>
      `Cancelar o atendimento de ${firstName} ${atTime}. Confirma?`,
    markNoShowConfirmation: (firstName: string, fromTime: string) =>
      `Marcar ${firstName} como ausente no atendimento ${fromTime}. Confirma?`,
    blockConfirmation: (day: string, interval: string) =>
      day ? `Bloquear ${day}, ${interval}. Confirma?` : `Bloquear ${interval}. Confirma?`,
    arrived: (firstName: string, atTime: string) => `${firstName} chegou ${atTime}`,
    arrivalsTotal: (count: string) => `Hoje, ${count} chegaram`,
    nobodyArrived: "Ninguém chegou ainda.",
    offerFullAgenda: "Quer que eu fale todos?",
    agendaEntry: (firstName: string, atTime: string) => `${firstName} ${atTime}`,
  },
  therapistActions: {
    sessionStarted: (firstName: string) => `Sessão com ${firstName} iniciada`,
    sessionFinished: "Sessão finalizada",
    noShowMarked: "Ausência registrada",
    cancelled: "Cancelado",
    blocked: "Bloqueado",
  },
  alexa: {
    welcome: "Olá. Você pode pedir o próximo atendimento ou a agenda do dia.",
    whatToSay: "Você pode dizer: próximo atendimento, agenda do dia ou quem chegou.",
    notUnderstood: "Não entendi. Você pode dizer: próximo atendimento ou agenda do dia.",
    goodbye: "Até logo.",
    presentationInvite: "Vamos juntos usá-las para abrir as portas da acessibilidade e bem-estar?",
    repeatHint: "Para ouvir de novo, diga repetir.",
    deviceNotPaired: "Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação.",
    devicePaired: (firstName: string) => `Pronto. Esta Alexa agora atende ${firstName}.`,
    pairingCodeRejected: "Código inválido ou expirado. Peça um novo código ao RH.",
    whoIsSpeaking: "Quem está falando?",
    whoIsSpeakingWithSurname: "Quem está falando? Diga o nome e o sobrenome.",
    speakerNotLinked: (names: string) => `Esta Alexa atende ${names}. Quem está falando?`,
    speakersOfDevice: (names: string) => `Esta Alexa atende ${names}.`,
    nothingChanged: "Tudo bem, nada foi alterado.",
    fullAgendaDeclined: "Tudo bem.",
    nothingToConfirm: "Não há nada para confirmar. Você pode dizer: próximo atendimento ou agenda do dia.",
    appointmentLeftAgenda: "Esse atendimento foi cancelado ou liberado antes da confirmação. Nada foi alterado.",
    vagueCancelTime: "Diga o horário exato do atendimento, por exemplo: cancelar o atendimento das duas da tarde.",
    noAppointmentAt: (atTimes: string) => `Não há atendimento ${atTimes} hoje.`,
    ambiguousTime: (atTimes: string) => `Há atendimentos ${atTimes}. Diga, por exemplo: duas da tarde.`,
    vagueBlockPeriod: "Diga o horário exato, por exemplo: bloquear das três às quatro da tarde.",
    blockPeriodRefused:
      "O bloqueio precisa ser hoje, dentro do horário de funcionamento, com o fim depois do início. " +
      "Diga, por exemplo: bloquear das três às quatro da tarde.",
    failure: "Não consegui consultar a agenda agora. Tente de novo em instantes.",
  },
  notifications: {
    checkInConfirmed: (dateTime: string, roomName: string) => `Check-in confirmado para ${dateTime}, na ${roomName}.`,
    employeeArrived: (firstName: string, atTime: string, roomName: string) =>
      `${firstName} chegou para o atendimento de hoje, ${atTime}, na ${roomName}.`,
    possibleNoShow: (firstName: string, atTime: string, roomName: string) =>
      `${firstName} ainda não fez check-in para o atendimento de hoje, ${atTime}, na ${roomName}.`,
    cancelledByTherapist: (date: string, atTime: string, therapistFirstName: string) =>
      `Seu atendimento de ${date}, ${atTime}, com ${therapistFirstName}, foi cancelado pelo massoterapeuta. ` +
      "Você pode reservar outro horário na página inicial.",
    feedSummary: (count: string) => `Você tem ${count}`,
    markedAsRead: "Aviso marcado como lido.",
  },
} as const;
