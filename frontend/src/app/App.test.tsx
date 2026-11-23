import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible } from "@/test/axe";
import App from "./App";
import { nextDays } from "@/shared/time/local-time";
import type {
  Appointment,
  Availability,
  AvailableSlot,
  DemoUser,
  Location,
  Profile,
  TherapistAgenda,
} from "@/shared/api/schemas";

vi.mock("@/shared/visuals/LogoWire", () => ({ default: () => null }));

type RequestHeaders = Record<string, string>;
type RequestBody = Record<string, unknown> | undefined;
type Route = (url: URL, headers: RequestHeaders, body: RequestBody) => [status: number, data: unknown];

interface Call {
  key: string;
  url: URL;
  headers: RequestHeaders;
  body: RequestBody;
}

const BEATRIZ = "00000000-0000-4000-8000-000000000103";
const MARINA = "00000000-0000-4000-8000-000000000101";
const RENATA = "00000000-0000-4000-8000-000000000201";
const OTAVIO = "00000000-0000-4000-8000-000000000301";
const DEMO_USERS: DemoUser[] = [
  {
    id: BEATRIZ,
    name: "Beatriz Lima",
    firstName: "Beatriz",
    role: "EMPLOYEE",
    roleLabel: "Colaborador",
    spokenText: "Beatriz Lima, colaborador.",
  },
  {
    id: MARINA,
    name: "Marina Castro",
    firstName: "Marina",
    role: "THERAPIST",
    roleLabel: "Massoterapeuta",
    spokenText: "Marina Castro, massoterapeuta.",
  },
];
const ME: Record<string, Profile> = {
  [BEATRIZ]: {
    id: BEATRIZ,
    role: "EMPLOYEE",
    effectiveRoles: ["EMPLOYEE"],
    name: "Beatriz Lima",
    firstName: "Beatriz",
    therapistId: null,
    spokenText: "Você entrou como Beatriz, colaborador.",
  },
  [MARINA]: {
    id: MARINA,
    role: "THERAPIST",
    effectiveRoles: ["THERAPIST"],
    name: "Marina Castro",
    firstName: "Marina",
    therapistId: "t1",
    spokenText: "Você entrou como Marina, massoterapeuta.",
  },
  [RENATA]: {
    id: RENATA,
    role: "HR",
    effectiveRoles: ["HR"],
    name: "Renata Alves",
    firstName: "Renata",
    therapistId: null,
    spokenText: "Você entrou como Renata, RH.",
  },
  [OTAVIO]: {
    id: OTAVIO,
    role: "ADMIN",
    effectiveRoles: ["ADMIN", "HR"],
    name: "Otávio Reis",
    firstName: "Otávio",
    therapistId: null,
    spokenText: "Você entrou como Otávio, suporte.",
  },
};
const SP: Location = { id: "l1", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" };
const LD: Location = { id: "l2", code: "LONDRINA", name: "Londrina", timezone: "America/Sao_Paulo" };
const TOMORROW = nextDays(2)[1];
const at = (h: number, m: number) =>
  new Date(`${TOMORROW}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`).toISOString();
const slot = (h: number, m: number, therapistId: string, therapistName: string, location: Location): AvailableSlot => ({
  startsAt: at(h, m),
  endsAt: at(h, m + 20),
  therapistId,
  therapistName,
  roomId: `r-${location.code}`,
  roomName: "Sala 1",
  location,
});
const AVAILABILITY = {
  sessionDurationMinutes: 20,
  therapists: [
    { id: "t1", name: "Marina Castro" },
    { id: "t2", name: "Felipe Nogueira" },
  ],
  slots: [
    slot(10, 0, "t1", "Marina Castro", SP),
    slot(10, 20, "t1", "Marina Castro", SP),
    slot(14, 0, "t2", "Felipe Nogueira", LD),
  ],
  waitlistSlots: [],
  spokenText: "Há 3 horários livres.",
} as Availability;
AVAILABILITY.sessionDurationMinutes = 20;
const UPCOMING: Appointment = {
  id: "a1",
  therapistId: "t1",
  roomId: "r-SAO_PAULO",
  startsAt: at(15, 0),
  endsAt: at(15, 20),
  status: "CONFIRMED",
  therapistName: "Marina Castro",
  roomName: "Sala 1",
  locationCode: "SAO_PAULO",
};
const THERAPIST_AGENDA: TherapistAgenda = {
  date: "2026-11-03",
  isToday: true,
  current: null,
  next: null,
  remainingCount: 0,
  items: [],
  spokenText: "Você não tem atendimentos hoje.",
};

function expectRadioOrder(group: HTMLElement, labels: readonly string[]) {
  const radios = labels.map((name) => within(group).getByRole("radio", { name }));
  for (let index = 1; index < radios.length; index += 1) {
    const previous = radios[index - 1];
    const current = radios[index];
    if (!previous || !current) throw new Error("Expected radio controls to exist.");
    expect(Boolean(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  }
}

let calls: Call[];
function mockApi(overrides: Record<string, Route> = {}) {
  calls = [];
  const routes: Record<string, Route> = {
    "GET /api/auth/demo-users": () => [200, DEMO_USERS],
    "GET /api/me": (_u, h) => {
      const me = ME[h["x-user-id"] ?? ""];
      return me
        ? [200, me]
        : [
            401,
            {
              message:
                "Não encontramos um usuário ativo com essa identificação: escolha um usuário na tela de entrada.",
            },
          ];
    },
    "GET /api/therapists/me/agenda": () => [200, THERAPIST_AGENDA],
    "GET /api/notifications": () => [200, { items: [], nextCursor: null, spokenText: "Você não tem avisos." }],
    "POST /api/notifications/notice-1/read": () => [
      200,
      { id: "notice-1", readAt: "2026-11-03T12:00:00.000Z", spokenText: "Aviso marcado como lido." },
    ],
    "GET /api/locations": () => [200, [SP, LD].map(({ code, name, timezone }) => ({ code, name, timezone }))],
    "GET /api/booking/availability": (u) =>
      u.searchParams.has("from") ? [200, AVAILABILITY] : [400, { message: "A duração informada é inválida." }],
    "GET /api/booking/appointments": () => [
      200,
      { upcoming: [UPCOMING], past: [], spokenText: "Você tem 1 agendamento futuro." },
    ],
    "POST /api/feedback": () => [201, { spokenText: "Obrigado por compartilhar sua experiência." }],
    "GET /api/booking/waitlist": () => [200, { items: [], spokenText: "Sem entradas." }],
    "GET /api/users": () => [200, []],
    "GET /api/booking/appointments/next": () => [200, { appointment: UPCOMING, spokenText: "Sua próxima sessão…" }],
    "POST /api/booking/appointments": (_u, _h, body) => [
      201,
      {
        id: "b0b0b0b0-1111",
        ...body,
        status: "CONFIRMED",
        therapistName: "Marina Castro",
        roomName: "Sala 1",
        locationCode: "SAO_PAULO",
        spokenText: "Reserva confirmada com Marina.",
      },
    ],
    "DELETE /api/booking/appointments/a1": () => [
      200,
      { ...UPCOMING, status: "CANCELLED", spokenText: "Sessão cancelada." },
    ],
    "POST /api/booking/check-in/sala-token": () => [
      200,
      { status: "CHECKED_IN", spokenText: "Check-in confirmado na Sala 1." },
    ],
    ...overrides,
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init = {}) => {
    const u = new URL(url instanceof Request ? url.url : url, "http://localhost");
    const key = `${init.method ?? "GET"} ${u.pathname}`;
    const body: RequestBody = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const headers: RequestHeaders = Object.fromEntries(new Headers(init.headers));
    calls.push({ key, url: u, headers, body });
    const route = routes[key];
    const [status, data] = route ? route(u, headers, body) : [404, { message: "Não encontrado." }];
    return new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

async function expectHeadingOnLoad(name: string | RegExp) {
  const heading = await screen.findByRole("heading", { level: 1, name });
  expect(heading).not.toHaveFocus();
  return heading;
}

async function expectFocusedHeading(name: string | RegExp) {
  const heading = await screen.findByRole("heading", { level: 1, name });
  await waitFor(() => expect(heading).toHaveFocus());
  return heading;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("entrar como… (D-12)", () => {
  it("lista os usuários ativos por papel, sem violações de acessibilidade", async () => {
    mockApi();
    render(<App />);
    await expectHeadingOnLoad("Entrar como…");
    expect(screen.getByRole("heading", { level: 2, name: "Colaborador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar como Marina Castro, Massoterapeuta" })).toBeInTheDocument();
    await expectAccessible();
  });

  it("entra como colaborador e abre a área de reservas com o perfil de GET /me", async () => {
    mockApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar como Beatriz Lima, Colaborador" }));
    expect(await screen.findByRole("heading", { level: 1, name: /Uma pausa no seu dia/ })).toBeInTheDocument();
    expect(localStorage.getItem("userId")).toBe(BEATRIZ);
    expect(calls.find((c) => c.key === "GET /api/me")?.headers["x-user-id"]).toBe(BEATRIZ);
  });

  it("TK-09.03: ignora um usuário guardado fora do formato e mostra a escolha sem chamar GET /me", async () => {
    localStorage.setItem("userId", "<script>");
    mockApi();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Entrar como…" })).toBeInTheDocument();
    expect(calls.some((c) => c.key === "GET /api/me")).toBe(false);
  });

  it("volta para a escolha quando o usuário guardado não é mais reconhecido", async () => {
    localStorage.setItem("userId", "00000000-0000-4000-8000-000000000999");
    mockApi();
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não encontramos um usuário ativo");
    expect(localStorage.getItem("userId")).toBeNull();
  });
});

describe("área do colaborador", () => {
  beforeEach(() => {
    localStorage.setItem("userId", BEATRIZ);
    window.history.replaceState({}, "", "/sessions");
  });

  it("TK-10.02 RF-01 RF-02: descobre a duração vigente e mostra horários no fluxo de reserva", async () => {
    mockApi({
      "GET /api/locations": () => [
        200,
        [
          { code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" },
          { code: "LONDRINA", name: "Londrina", timezone: "America/Sao_Paulo" },
        ],
      ],
      "GET /api/booking/availability": () => [200, { ...AVAILABILITY, sessionDurationMinutes: 35 }],
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Reservar" })).toBeInTheDocument();
    expect(await screen.findByText(/Sessões de massoterapia de 35 minutos/)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Unidade" })).toBeInTheDocument();
    expect(calls.filter((call) => call.key === "GET /api/locations")).toHaveLength(1);
    const availabilityCalls = calls.filter((call) => call.key === "GET /api/booking/availability");
    expect(availabilityCalls).toHaveLength(1);
    expect(availabilityCalls[0]?.url.searchParams.has("durationMinutes")).toBe(false);
    await expectAccessible();
  });

  it("TK-10.03 RF-07: abre uma página própria com sessões futuras e anteriores na ordem da API", async () => {
    const pastAppointments: Appointment[] = [
      { ...UPCOMING, id: "past-first", startsAt: at(9, 0), endsAt: at(9, 20), status: "COMPLETED" },
      { ...UPCOMING, id: "past-second", startsAt: at(11, 0), endsAt: at(11, 20), status: "CANCELLED" },
    ];
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: [UPCOMING], past: pastAppointments, spokenText: "Você tem sessões futuras e anteriores." },
      ],
    });
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Suas sessões" })).toBeInTheDocument();
    await screen.findByRole("heading", { level: 2, name: "Próximas" });
    expect(screen.queryByRole("radiogroup", { name: "Horário" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Próximas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Anteriores" })).toBeInTheDocument();
    const pastList = screen.getByRole("list", { name: "Sessões anteriores" });
    expect(
      within(pastList)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining("09:00"), expect.stringContaining("11:00")]);
    await expectAccessible();
  });

  it("TK-16.03 RF-34 RN-18 RN-04: offers an anonymous accessible survey after a completed session", async () => {
    const completed = { ...UPCOMING, id: "past-completed", startsAt: at(9, 0), status: "COMPLETED" as const };
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: [], past: [completed], spokenText: "Você tem uma sessão anterior concluída." },
      ],
      "POST /api/feedback": () => [201, { spokenText: "Obrigado por compartilhar sua experiência." }],
    });
    render(<App />);

    const invite = await screen.findByRole("button", { name: "Responder à pesquisa de satisfação" });
    await userEvent.click(invite);
    expect(invite).toHaveAttribute("aria-expanded", "true");
    expect(invite).toHaveFocus();
    const question1 = screen.getByRole("radiogroup", {
      name: "Como você avalia a facilidade para realizar o agendamento pela plataforma?",
    });
    const question2 = screen.getByRole("radiogroup", {
      name: "Em relação à tecnologia, a plataforma atendeu às suas necessidades de uso e navegabilidade?",
    });
    const question3 = screen.getByRole("radiogroup", { name: "Como você avalia o serviço de massoterapia recebido?" });
    const question4 = screen.getByRole("radiogroup", {
      name: "De 0 a 10, o quanto você recomendaria nossa plataforma e serviços para um amigo ou familiar?",
    });
    expectRadioOrder(question1, [
      "Muito fácil",
      "Fácil",
      "Regular",
      "Difícil",
      "Muito difícil",
    ]);
    expectRadioOrder(question2, [
      "Atendeu totalmente",
      "Atendeu em grande parte",
      "Atendeu parcialmente",
      "Não atendeu",
    ]);
    expectRadioOrder(question3, ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"]);
    expectRadioOrder(
      question4,
      Array.from({ length: 11 }, (_, value) => String(value)),
    );
    expect(screen.getByText(/Suas respostas não são vinculadas/)).toBeInTheDocument();
    await expectAccessible();

    const veryEasy = within(question1).getByRole("radio", { name: "Muito fácil" });
    await userEvent.click(veryEasy);
    await userEvent.keyboard("{ArrowDown}");
    expect(within(question1).getByRole("radio", { name: "Fácil" })).toBeChecked();
    await userEvent.click(veryEasy);
    await userEvent.click(within(question2).getByRole("radio", { name: "Atendeu totalmente" }));
    await userEvent.click(within(question3).getByRole("radio", { name: "Excelente" }));
    await userEvent.click(within(question4).getByRole("radio", { name: "10" }));
    await userEvent.type(screen.getByRole("textbox", { name: /O que podemos fazer/ }), " Melhorar o acesso. ");
    const submit = screen.getByRole("button", { name: "Enviar pesquisa" });
    await userEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Obrigado por compartilhar sua experiência."));
    expect(submit).toHaveFocus();
    expect(screen.getByText("Obrigado por fazer parte da construção do nosso projeto!")).toBeInTheDocument();
    expect(calls.find((call) => call.key === "POST /api/feedback")?.body).toEqual({
      bookingEase: 1,
      technologySatisfaction: 1,
      serviceRating: 1,
      recommendationScore: 10,
      comment: "Melhorar o acesso.",
    });
    await expectAccessible();
  });

  it("TK-16.03 RF-34 RN-18: does not offer feedback without a completed session", async () => {
    mockApi();
    render(<App />);

    await screen.findByRole("heading", { level: 2, name: "Anteriores" });
    expect(screen.queryByRole("button", { name: "Responder à pesquisa de satisfação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pesquisa de satisfação" })).not.toBeInTheDocument();
  });

  it("TK-16.03 RF-34 RN-04: focuses required and server errors, preserves answers and allows retry", async () => {
    const completed = { ...UPCOMING, id: "past-completed", startsAt: at(9, 0), status: "COMPLETED" as const };
    let attempts = 0;
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: [], past: [completed], spokenText: "Você tem uma sessão anterior concluída." },
      ],
      "POST /api/feedback": () => {
        attempts += 1;
        return attempts === 1
          ? [503, { message: "Tente novamente mais tarde." }]
          : [201, { spokenText: "Obrigado por compartilhar sua experiência." }];
      },
    });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Responder à pesquisa de satisfação" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar pesquisa" }));

    const requiredError = await screen.findByRole("alert");
    expect(requiredError).toHaveTextContent("Responda às quatro perguntas obrigatórias");
    expect(requiredError).toHaveFocus();
    expect(attempts).toBe(0);

    await userEvent.click(screen.getByRole("radio", { name: "Muito fácil" }));
    await userEvent.click(screen.getByRole("radio", { name: "Atendeu totalmente" }));
    await userEvent.click(screen.getByRole("radio", { name: "Excelente" }));
    await userEvent.click(screen.getByRole("radio", { name: "7" }));
    const comment = screen.getByRole("textbox", { name: /O que podemos fazer/ });
    await userEvent.type(comment, "Sugestão preservada.");
    const submit = screen.getByRole("button", { name: "Enviar pesquisa" });
    await userEvent.click(submit);

    const serverError = await screen.findByRole("alert");
    expect(serverError).toHaveTextContent("Não foi possível enviar suas respostas.");
    expect(serverError).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Muito fácil" })).toBeChecked();
    expect(comment).toHaveValue("Sugestão preservada.");
    await userEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Obrigado por compartilhar sua experiência."));
    expect(attempts).toBe(2);
    expect(submit).toHaveFocus();
  });

  it("TK-10.03 RF-07: mostra estados vazios distintos e anuncia o resumo do backend", async () => {
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: [], past: [], spokenText: "Você não tem agendamentos." },
      ],
    });
    render(<App />);

    expect(await screen.findByText("Você não tem agendamentos.", { selector: "p.none" })).toBeInTheDocument();
    expect(screen.getByText("Você ainda não tem sessões anteriores.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Suas sessões" })).getByRole("link", { name: "Reservar horário" }),
    ).toHaveAttribute("href", "/book");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Você não tem agendamentos."));
    await expectAccessible();
  });

  it("TK-10.03 RF-07: foca o título ao navegar para Suas sessões", async () => {
    window.history.replaceState({}, "", "/");
    mockApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Suas sessões" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Suas sessões" })).toHaveFocus());
  });

  it("TK-10.03 RF-07: permite tentar novamente depois de falha ao carregar as sessões", async () => {
    let attempts = 0;
    mockApi({
      "GET /api/booking/appointments": () => {
        attempts += 1;
        return attempts === 1
          ? [503, { message: "Não foi possível carregar suas sessões." }]
          : [200, { upcoming: [UPCOMING], past: [], spokenText: "Você tem 1 agendamento futuro." }];
      },
    });
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("heading", { level: 2, name: "Próximas" });
    expect(attempts).toBe(2);
    expect(screen.getByText(/com Marina Castro/)).toBeInTheDocument();
  });

  it("TK-10.03 RF-03 RF-07: confirma o cancelamento, anuncia a resposta e foca a próxima sessão", async () => {
    const nextAppointment = { ...UPCOMING, id: "a2", startsAt: at(16, 0), endsAt: at(16, 20) };
    let cancelled = false;
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        {
          upcoming: cancelled ? [nextAppointment] : [UPCOMING, nextAppointment],
          past: [],
          spokenText: "Sua lista de sessões foi atualizada.",
        },
      ],
      "DELETE /api/booking/appointments/a1": () => {
        cancelled = true;
        return [200, { ...UPCOMING, status: "CANCELLED", spokenText: "Sessão cancelada com sucesso." }];
      },
    });
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: "Próximas" });
    const sessions = screen.getByRole("region", { name: "Suas sessões" });
    const cancelButton = await within(sessions).findByRole("button", { name: /15:00$/ });
    await userEvent.click(cancelButton);
    const dialog = await screen.findByRole("alertdialog", { name: "Cancelar esta sessão?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar sessão" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sessão cancelada com sucesso."));
    await waitFor(() => expect(within(sessions).getAllByRole("listitem")).toHaveLength(1));
    await waitFor(() => expect(within(sessions).getByRole("listitem")).toHaveFocus());
  });

  it("TK-10.03 RF-03: mantém a sessão e informa o erro quando a API recusa o cancelamento", async () => {
    mockApi({
      "DELETE /api/booking/appointments/a1": () => [409, { message: "Esta sessão não pode mais ser cancelada." }],
    });
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: "Próximas" });
    const sessions = screen.getByRole("region", { name: "Suas sessões" });
    await userEvent.click(within(sessions).getByRole("button", { name: /^Cancelar a sessão de/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancelar esta sessão?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar sessão" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Esta sessão não pode mais ser cancelada.");
    expect(within(sessions).getByText("Confirmada")).toBeInTheDocument();
    expect(calls.filter((call) => call.key === "DELETE /api/booking/appointments/a1")).toHaveLength(1);
  });

  it("TK-10.02 RF-02: reserva o horário da rota própria, anuncia a resposta e atualiza a disponibilidade", async () => {
    let reserved = false;
    mockApi({
      "GET /api/booking/availability": () => [
        200,
        {
          ...AVAILABILITY,
          slots: reserved
            ? AVAILABILITY.slots.filter((available) => available.startsAt !== at(10, 20))
            : AVAILABILITY.slots,
        },
      ],
      "POST /api/booking/appointments": (_url, _headers, body) => {
        reserved = true;
        return [
          201,
          {
            id: "b0b0b0b0-1111",
            ...body,
            status: "CONFIRMED",
            therapistName: "Marina Castro",
            roomName: "Sala 1",
            locationCode: "SAO_PAULO",
            spokenText: "Reserva confirmada com Marina.",
          },
        ];
      },
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);
    const slots = await screen.findByRole("radiogroup", { name: "Horário" });
    await userEvent.click(within(slots).getByRole("radio", { name: /10:20/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }));
    const post = calls.find((c) => c.key === "POST /api/booking/appointments");
    expect(post?.body).toEqual({ startsAt: at(10, 20), endsAt: at(10, 40), therapistId: "t1", roomId: "r-SAO_PAULO" });
    expect(post?.headers["x-user-id"]).toBe(BEATRIZ);
    const confirmation = await screen.findByRole("heading", { level: 3, name: /^Até .* às 10:20, Beatriz\.$/ });
    await waitFor(() => expect(confirmation).toHaveFocus());
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "" }).textContent).toBe("Reserva confirmada com Marina."),
    );
    await waitFor(() => expect(within(slots).queryByRole("radio", { name: /10:20/ })).not.toBeInTheDocument());
  });

  it("mostra no formulário a mensagem de erro do backend", async () => {
    mockApi({
      "POST /api/booking/appointments": () => [
        409,
        { message: "Você já tem o máximo de reservas futuras. Cancele uma para agendar outra." },
      ],
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);
    const slots = await screen.findByRole("radiogroup", { name: "Horário" });
    await userEvent.click(within(slots).getByRole("radio", { name: /10:00/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você já tem o máximo de reservas futuras.");
  });

  it("TK-09.03 RNF-04: anuncia como erro horários fora do contrato e não mostra nenhum deles", async () => {
    mockApi({
      "GET /api/booking/availability": (u) =>
        u.searchParams.has("from")
          ? [200, { ...AVAILABILITY, slots: [{ ...AVAILABILITY.slots[0], location: { code: "RECIFE" } }] }]
          : [400, { message: "A duração informada é inválida." }],
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);
    expect(
      await screen.findByText(/Não foi possível ler a resposta do servidor\. Tente de novo\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar os dados da reserva/).closest("[role=alert]")).not.toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Horário" })).not.toBeInTheDocument();
  });

  it("TK-09.03 RNF-04: anuncia como erro uma resposta fora do contrato e não mostra nenhum dado dela", async () => {
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: [{ ...UPCOMING, status: "DESCONHECIDO" }], past: [], spokenText: "Você tem 1 agendamento futuro." },
      ],
    });
    render(<App />);
    const sessions = await screen.findByRole("region", { name: /Suas sess/ });
    expect(await within(sessions).findByRole("alert")).toHaveTextContent(
      "Não foi possível ler a resposta do servidor. Tente de novo.",
    );
    expect(within(sessions).queryByText("Você tem 1 agendamento futuro.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancelar a sessão de/ })).not.toBeInTheDocument();
  });

  it("filtra os terapeutas pela unidade escolhida", async () => {
    mockApi();
    window.history.replaceState({}, "", "/book");
    render(<App />);
    await userEvent.click(await screen.findByRole("radio", { name: "Londrina" }));
    const therapists = screen.getByRole("radiogroup", { name: "Terapeuta" });
    expect(
      within(therapists)
        .getAllByRole("radio")
        .map((r) => r.closest("label")?.textContent),
    ).toEqual(["Sem preferência", "Felipe Nogueira"]);
  });

  it("cancela uma sessão depois de confirmar no diálogo", async () => {
    mockApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: /^Cancelar a sessão de/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancelar esta sessão?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await expectAccessible(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar sessão" }));
    await waitFor(() => expect(calls.some((c) => c.key === "DELETE /api/booking/appointments/a1")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it.each([
    ["ao título da lista quando ela fica vazia", []],
    ["à próxima sessão quando ainda há outra", [{ ...UPCOMING, id: "a2", startsAt: at(16, 0), endsAt: at(16, 20) }]],
  ])("TK-09.05 RNF-01: depois de cancelar, leva o foco %s", async (_case, remaining: Appointment[]) => {
    let cancelled = false;
    mockApi({
      "GET /api/booking/appointments": () => [
        200,
        { upcoming: cancelled ? remaining : [UPCOMING, ...remaining], past: [], spokenText: "Suas sessões." },
      ],
      "DELETE /api/booking/appointments/a1": () => {
        cancelled = true;
        return [200, { ...UPCOMING, status: "CANCELLED", spokenText: "Sessão cancelada." }];
      },
    });
    render(<App />);
    const sessions = await screen.findByRole("region", { name: /Suas sess/ });
    await within(sessions).findAllByRole("button", { name: /^Cancelar a sessão de/ });
    await userEvent.click(within(sessions).getByRole("button", { name: /^Cancelar a sessão de .*, 15:00$/ }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar sessão" }),
    );
    await waitFor(() =>
      expect(within(sessions).queryAllByRole("button", { name: /^Cancelar a sessão de/ })).toHaveLength(
        remaining.length,
      ),
    );
    const expected = remaining.length
      ? within(sessions).getByRole("listitem")
      : within(sessions).getByRole("heading", { level: 2, name: "Próximas" });
    await waitFor(() => expect(expected).toHaveFocus());
  });

  it("TK-10.05 RF-06: confirma o check-in pelo token da sala e anuncia a resposta", async () => {
    window.history.replaceState({}, "", "/check-in/sala-token");
    mockApi();
    render(<App />);
    await expectHeadingOnLoad("Check-in");
    await expectAccessible();
    await userEvent.click(screen.getByRole("button", { name: "Fazer check-in" }));
    expect(await screen.findByText("Check-in confirmado na Sala 1.", { selector: "p" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Check-in confirmado na Sala 1."));
    expect(calls.find((call) => call.key === "POST /api/booking/check-in/sala-token")?.body).toBeUndefined();
    expect(screen.queryByText("sala-token")).not.toBeInTheDocument();
  });

  it("TK-10.05 RF-06: move o foco ao erro que impede o check-in e permite tentar novamente", async () => {
    window.history.replaceState({}, "", "/check-in/sala-token");
    mockApi({
      "POST /api/booking/check-in/sala-token": () => [400, { message: "O check-in ainda não está disponível." }],
    });
    render(<App />);
    await expectHeadingOnLoad("Check-in");
    await userEvent.click(screen.getByRole("button", { name: "Fazer check-in" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveFocus();
    expect(error).toHaveTextContent("O check-in ainda não está disponível.");
    expect(screen.getByRole("button", { name: "Fazer check-in" })).toBeEnabled();
  });
});

describe("TK-10.04 RF-04 RN-10: lista de espera do colaborador", () => {
  const waiting = {
    id: "w1",
    desiredStartsAt: "2026-11-10T17:00:00.000Z",
    desiredEndsAt: "2026-11-10T17:20:00.000Z",
    status: "WAITING",
    offeredAt: null,
    offerExpiresAt: null,
    spokenText: "Você está na lista de espera para terça-feira, 10 de novembro, às 14h.",
  };
  const offered = {
    ...waiting,
    id: "w2",
    status: "NOTIFIED",
    offeredAt: "2026-11-09T12:00:00.000Z",
    offerExpiresAt: "2026-11-09T12:30:00.000Z",
    spokenText:
      "Uma vaga ficou disponível para você em terça-feira, 10 de novembro, às 14h. A oferta expira em segunda-feira, 9 de novembro, às 9h30.",
  };

  beforeEach(() => {
    localStorage.setItem("userId", BEATRIZ);
    window.history.replaceState({}, "", "/sessions");
  });

  it("TK-10.04 RF-04 RN-10: oferece lista de espera quando a reserva informa que o horário está ocupado", async () => {
    const entry = { ...waiting, desiredStartsAt: at(10, 0), desiredEndsAt: at(10, 20) };
    mockApi({
      "POST /api/booking/appointments": () => [409, { message: "O horário não está disponível." }],
      "POST /api/booking/waitlist": (_url, _headers, body) => {
        expect(body).toEqual({
          desiredStartsAt: at(10, 0),
          desiredEndsAt: at(10, 20),
          therapistId: "t1",
          locationId: "l1",
        });
        return [201, entry];
      },
      "GET /api/booking/waitlist": () => [200, { items: [entry], spokenText: entry.spokenText }],
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);
    const slots = await screen.findByRole("radiogroup", { name: /Hor.rio/ });
    await userEvent.click(within(slots).getByRole("radio", { name: /10:00/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este horário já está reservado ou ficou indisponível.");
    expect(screen.getByText(/Lista de espera:/)).toHaveTextContent(/pode entrar para receber uma oferta/);
    await userEvent.click(screen.getByRole("button", { name: "Entrar na lista de espera para este horário" }));
    expect(await screen.findByRole("link", { name: "Ver lista de espera em Suas sessões" })).toHaveAttribute(
      "href",
      "/sessions#lista-de-espera",
    );
  });

  it("TK-10.04 RF-04 RN-10: permite entrar na fila escolhendo um horário ocupado diretamente", async () => {
    const occupied: AvailableSlot = {
      startsAt: at(10, 40),
      endsAt: at(11, 0),
      therapistId: "t1",
      therapistName: "Marina Castro",
      roomId: "r-SAO_PAULO",
      roomName: "Sala 1",
      location: SP,
    };
    const entry = {
      ...waiting,
      id: "w3",
      desiredStartsAt: occupied.startsAt,
      desiredEndsAt: occupied.endsAt,
      therapistId: occupied.therapistId,
      therapistName: occupied.therapistName,
      locationId: SP.id,
      locationName: SP.name,
    };
    mockApi({
      "GET /api/booking/availability": () => [200, { ...AVAILABILITY, slots: [], waitlistSlots: [occupied] }],
      "POST /api/booking/waitlist": (_url, _headers, body) => {
        expect(body).toEqual({
          desiredStartsAt: occupied.startsAt,
          desiredEndsAt: occupied.endsAt,
          therapistId: occupied.therapistId,
          locationId: SP.id,
        });
        return [201, entry];
      },
      "GET /api/booking/waitlist": () => [200, { items: [entry], spokenText: entry.spokenText }],
    });
    window.history.replaceState({}, "", "/book");
    render(<App />);

    const occupiedRadio = await screen.findByRole("radio", { name: /indisponível; aguardar uma vaga/ });
    expect(screen.queryByRole("heading", { name: "Horários ocupados" })).not.toBeInTheDocument();
    await userEvent.click(occupiedRadio);
    await userEvent.click(screen.getByRole("button", { name: "Aguardar uma vaga" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Entrar na lista de espera?" });
    expect(within(dialog).getByText(/Você vai aguardar/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Entrar na lista" }));
    await waitFor(() => expect(calls.some((call) => call.key === "POST /api/booking/waitlist")).toBe(true));
    expect(await screen.findByRole("status")).toHaveTextContent(entry.spokenText);
    await expectAccessible();
  });

  it("TK-10.04 RF-04 RN-10: exibe a lista de espera como seção de Suas sessões", async () => {
    mockApi({
      "GET /api/booking/waitlist": () => [
        200,
        { items: [waiting], spokenText: "Você tem 1 entrada na lista de espera." },
      ],
    });
    window.history.replaceState({}, "", "/sessions");
    render(<App />);

    const sessions = await screen.findByRole("region", { name: "Suas sessões" });
    expect(await within(sessions).findByRole("heading", { level: 2, name: "Lista de espera" })).toBeInTheDocument();
    expect(await within(sessions).findByRole("list", { name: "Entradas da lista de espera" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lista de espera" })).not.toBeInTheDocument();
    await expectAccessible();
  });

  it("TK-10.04 RF-04 RN-10: explica como entrar na lista quando ainda não há entradas", async () => {
    mockApi({
      "GET /api/booking/waitlist": () => [200, { items: [], spokenText: "Você não tem entradas na lista de espera." }],
    });
    render(<App />);
    await expectHeadingOnLoad("Suas sessões");
    expect(await screen.findByText(/Ao tentar reservar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver hor/ })).toHaveAttribute("href", "/book");
    await expectAccessible();
  });

  it("TK-10.04 RF-04 RN-10: mantém a ordem da API e apresenta ações conforme o estado", async () => {
    const entries = [
      waiting,
      offered,
      { ...waiting, id: "w3", status: "CONVERTED", spokenText: "A vaga foi confirmada como agendamento." },
      { ...waiting, id: "w4", status: "CANCELLED", spokenText: "Sua entrada foi cancelada." },
      { ...waiting, id: "w5", status: "EXPIRED", spokenText: "A oferta expirou." },
      { ...waiting, id: "w6", status: "DECLINED", spokenText: "A oferta foi recusada." },
    ];
    mockApi({
      "GET /api/booking/waitlist": () => [200, { items: entries, spokenText: "Você tem entradas na lista de espera." }],
    });
    render(<App />);
    const list = await screen.findByRole("list", { name: "Entradas da lista de espera" });
    const entriesOnScreen = within(list).getAllByRole("listitem");
    expect(entriesOnScreen.map((entry) => entry.textContent)).toEqual([
      expect.stringContaining("Aguardando vaga"),
      expect.stringContaining("Vaga oferecida"),
      expect.stringContaining("Convertida em agendamento"),
      expect.stringContaining("Saiu da lista"),
      expect.stringContaining("Oferta expirada"),
      expect.stringContaining("Oferta recusada"),
    ]);
    expect(screen.getAllByRole("button", { name: /Sair da lista de espera/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Recusar oferta/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver minhas sessões após conversão/ })).toHaveAttribute(
      "href",
      "/sessions#sessoes",
    );
  });

  it("TK-10.04 RF-04 RN-10: confirma a saída e mostra o estado atualizado da entrada", async () => {
    let items: Array<typeof waiting> = [waiting];
    mockApi({
      "GET /api/booking/waitlist": () => [200, { items, spokenText: "Você tem 1 entrada na lista de espera." }],
      "DELETE /api/booking/waitlist/w1": () => {
        items = [{ ...waiting, status: "CANCELLED", spokenText: "Sua entrada na lista de espera foi cancelada." }];
        return [204, undefined];
      },
    });
    render(<App />);
    await screen.findByText(waiting.spokenText);
    await userEvent.click(screen.getByRole("button", { name: /Sair da lista de espera/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Sair da lista de espera?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Sair da lista de espera" }));
    expect(await screen.findAllByText("Sua entrada na lista de espera foi cancelada.")).toHaveLength(2);
    expect(calls.some((call) => call.key === "DELETE /api/booking/waitlist/w1")).toBe(true);
  });

  it("TK-10.04 RF-04 RN-10: declines an offer and advances the waitlist", async () => {
    let current = offered;
    mockApi({
      "GET /api/booking/waitlist": () => [200, { items: [current], spokenText: "You have one waitlist offer." }],
      "POST /api/booking/waitlist/w2/decline": () => {
        current = { ...offered, status: "DECLINED", spokenText: "You declined this offer." };
        return [204, undefined];
      },
    });
    render(<App />);
    await screen.findByText(offered.spokenText);
    await userEvent.click(screen.getByRole("button", { name: /Recusar oferta/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Recusar esta oferta?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Recusar oferta" }));
    expect(await screen.findAllByText(current.spokenText)).toHaveLength(2);
    expect(calls.some((call) => call.key === "POST /api/booking/waitlist/w2/decline")).toBe(true);
  });

  it("TK-10.04 RF-04 RN-10: confirma o aceite e mostra o estado convertido retornado pela API", async () => {
    let current = offered;
    mockApi({
      "GET /api/booking/waitlist": () => [
        200,
        { items: [current], spokenText: "Você tem uma oferta na lista de espera." },
      ],
      "POST /api/booking/waitlist/w2/accept": () => {
        current = {
          ...offered,
          status: "CONVERTED",
          spokenText: "A vaga para terça-feira, 10 de novembro, às 14h foi confirmada como agendamento.",
        };
        return [201, UPCOMING];
      },
    });
    render(<App />);
    expect(await screen.findByText(offered.spokenText)).toBeInTheDocument();
    expect(screen.queryByText(/minutos restantes/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Aceitar horário oferecido/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Aceitar esta oferta?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Aceitar oferta" }));
    expect(await screen.findAllByText(current.spokenText)).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Ver minhas sessões após conversão/ })).toHaveAttribute(
      "href",
      "/sessions#sessoes",
    );
    expect(calls.some((call) => call.key === "POST /api/booking/waitlist/w2/accept")).toBe(true);
    await waitFor(() => expect(calls.filter((call) => call.key === "GET /api/booking/appointments")).toHaveLength(2));
  });

  it("TK-10.04 RF-04 RN-10: após a oferta expirar mostra o erro e recarrega o estado", async () => {
    let current = offered;
    mockApi({
      "GET /api/booking/waitlist": () => [
        200,
        { items: [current], spokenText: "Você tem uma oferta na lista de espera." },
      ],
      "POST /api/booking/waitlist/w2/accept": () => {
        current = {
          ...offered,
          status: "EXPIRED",
          spokenText: "A oferta para terça-feira, 10 de novembro, às 14h expirou.",
        };
        return [410, { message: "A oferta da vaga expirou." }];
      },
    });
    render(<App />);
    await screen.findByText(offered.spokenText);
    await userEvent.click(screen.getByRole("button", { name: /^Aceitar horário oferecido/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Aceitar esta oferta?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Aceitar oferta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A oferta da vaga expirou.");
    expect(screen.queryByRole("button", { name: /^Aceitar horário oferecido/ })).not.toBeInTheDocument();
  });

  it("TK-10.04 RF-04 RN-10: posiciona o foco no erro e permite recarregar a lista", async () => {
    let requestCount = 0;
    mockApi({
      "GET /api/booking/waitlist": () => {
        requestCount += 1;
        return requestCount === 1
          ? [503, { message: "O servidor não conseguiu atender o pedido." }]
          : [200, { items: [], spokenText: "Você não tem entradas na lista de espera." }];
      },
    });
    render(<App />);
    const error = await screen.findByRole("alert");
    await waitFor(() => expect(error).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Ver hor/ })).toBeInTheDocument());
    expect(requestCount).toBe(2);
  });
});

describe("TK-12.01 RF-20: usuários do RH", () => {
  const users = [
    {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Souza",
      role: "EMPLOYEE",
      status: "ACTIVE",
      therapistId: null,
      createdAt: "2026-11-02T12:00:00.000Z",
    },
    {
      id: "u-2",
      email: "bruno@example.com",
      name: "Bruno Lima",
      role: "THERAPIST",
      status: "INACTIVE",
      therapistId: "therapist-2",
      createdAt: "2026-11-02T12:00:00.000Z",
    },
  ];

  beforeEach(() => {
    localStorage.setItem("userId", RENATA);
    window.history.replaceState({}, "", "/hr/users");
  });

  it("TK-12.01 RF-20: troca de tela do RH pelo roteador, volta ao topo e leva o foco ao título", async () => {
    mockApi({ "GET /api/users": () => [200, users], "GET /api/business-rules": () => [200, []] });
    const scrollTo = vi.spyOn(window, "scrollTo");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Usuários" });
    const links = () => within(screen.getByRole("navigation", { name: "Navegação do RH" }));
    expect(links().getByRole("link", { name: "Usuários" })).toHaveAttribute("aria-current", "page");

    await user.click(links().getByRole("link", { name: "Horários e limites" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Horários e limites de agendamento" });
    expect(window.location.pathname).toBe("/hr/rules");
    await waitFor(() => expect(heading).toHaveFocus());
    await waitFor(() => expect(document.title).toBe("Horários e limites de agendamento · Pausa"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    expect(links().getByRole("link", { name: "Horários e limites" })).toHaveAttribute("aria-current", "page");
    expect(links().getByRole("link", { name: "Usuários" })).not.toHaveAttribute("aria-current");
    await expectAccessible();
    scrollTo.mockRestore();
  });

  it.each(["Control", "Meta", "Shift", "Alt"])(
    "TK-12.01 RF-20: %s e clique no menu do RH não troca de tela nem rola a página atual",
    async (modifier) => {
      mockApi({ "GET /api/users": () => [200, users] });
      const scrollTo = vi.spyOn(window, "scrollTo");
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole("heading", { level: 1, name: "Usuários" });
      const menu = within(screen.getByRole("navigation", { name: "Navegação do RH" }));

      await user.keyboard(`{${modifier}>}`);
      await user.click(menu.getByRole("link", { name: "Agendas" }));
      await user.keyboard(`{/${modifier}}`);

      expect(window.location.pathname).toBe("/hr/users");
      expect(scrollTo).not.toHaveBeenCalled();
      scrollTo.mockRestore();
    },
  );

  it("TK-12.01 RF-20: lista usuários em tabela acessível e envia filtros à API", async () => {
    mockApi({ "GET /api/users": () => [200, users] });
    render(<App />);

    const heading = await screen.findByRole("heading", { level: 1, name: "Usuários" });
    expect(heading).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Usuários cadastrados" });
    expect(within(table).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(table).getByText("Bruno Lima")).toBeInTheDocument();
    await expectAccessible();

    await userEvent.click(screen.getByRole("button", { name: /Papel/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Massoterapeuta" }));
    await userEvent.click(screen.getByRole("button", { name: /Status/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Inativo" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nome ou e-mail" }), "bruno");
    await userEvent.click(screen.getByRole("button", { name: "Buscar usuários" }));

    await waitFor(() => {
      const query = calls.filter((call) => call.key === "GET /api/users").at(-1)?.url.searchParams;
      expect(query?.get("role")).toBe("THERAPIST");
      expect(query?.get("status")).toBe("INACTIVE");
      expect(query?.get("search")).toBe("bruno");
    });
    expect(calls.find((call) => call.key === "GET /api/users")?.headers["x-user-id"]).toBe(RENATA);
  });

  it("TK-12.01 RF-20: cria usuário e recebe o perfil de massoterapeuta criado pela API", async () => {
    mockApi({
      "GET /api/users": () => [200, users],
      "POST /api/users": (_url, _headers, body) => [
        201,
        {
          ...users[0],
          id: "u-3",
          email: "carla@example.com",
          name: "Carla Dias",
          role: "THERAPIST",
          therapistId: "t-3",
          ...body,
        },
      ],
    });
    render(<App />);
    await screen.findByRole("table", { name: "Usuários cadastrados" });
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nome completo" }), "Carla Dias");
    await userEvent.type(screen.getByRole("textbox", { name: "E-mail" }), "carla@example.com");
    await userEvent.click(screen.getByRole("button", { name: /Novo papel/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Massoterapeuta" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar usuário" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "Cadastrar este usuário?" });
    expect(within(confirmation).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.click(within(confirmation).getByRole("button", { name: "Confirmar cadastro" }));

    expect(await screen.findByText(/Carla Dias cadastrado como Massoterapeuta/)).toBeInTheDocument();
    expect(calls.find((call) => call.key === "POST /api/users")?.body).toEqual({
      email: "carla@example.com",
      name: "Carla Dias",
      role: "THERAPIST",
    });
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Carla Dias"))).toBe(true),
    );
    await expectAccessible();
  });

  it("TK-12.01 RF-20: confirma a mudança de status e anuncia o resultado", async () => {
    mockApi({
      "GET /api/users": () => [200, users],
      "PATCH /api/users/u-1/status": () => [200, { ...users[0], status: "INACTIVE" }],
    });
    render(<App />);
    const table = await screen.findByRole("table", { name: "Usuários cadastrados" });
    await userEvent.click(within(table).getByRole("button", { name: "Desativar usuário Ana Souza" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Desativar este usuário?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Desativar usuário" }));
    await waitFor(() => expect(calls.some((call) => call.key === "PATCH /api/users/u-1/status")).toBe(true));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(within(table).getByRole("button", { name: "Ativar usuário Ana Souza" })).toHaveFocus());
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Ana Souza desativado"))).toBe(
        true,
      ),
    );
    await expectAccessible();
  });

  it("TK-12.01 RF-20: apresenta vazio e permite tentar novamente após erro", async () => {
    mockApi({ "GET /api/users": () => [503, { message: "Tente novamente." }] });
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    expect(alert).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(calls.filter((call) => call.key === "GET /api/users")).toHaveLength(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor não conseguiu atender o pedido.");
  });

  it("TK-12.01 RF-20: informa quando a busca não encontra usuários", async () => {
    mockApi({ "GET /api/users": () => [200, []] });
    render(<App />);
    const results = await screen.findByRole("region", { name: "Usuários cadastrados" });
    expect(await within(results).findByText("Nenhum usuário encontrado.")).toBeInTheDocument();
    await expectAccessible();
  });

  it("TK-12.01 RF-20: mantém o cadastro preenchido e foca a mensagem de e-mail duplicado", async () => {
    mockApi({
      "GET /api/users": () => [200, users],
      "POST /api/users": () => [409, { message: "Já existe um usuário cadastrado com este e-mail." }],
    });
    render(<App />);
    await screen.findByRole("table", { name: "Usuários cadastrados" });
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
    const name = screen.getByRole("textbox", { name: "Nome completo" });
    const email = screen.getByRole("textbox", { name: "E-mail" });
    await userEvent.type(name, "Carla Dias");
    await userEvent.type(email, "carla@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Salvar usuário" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cadastrar este usuário?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar cadastro" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Já existe um usuário cadastrado com este e-mail.");
    expect(error).toHaveFocus();
    expect(name).toHaveValue("Carla Dias");
    expect(email).toHaveValue("carla@example.com");
  });

  it("TK-12.01 RF-20: permite que ADMIN use a área do RH", async () => {
    localStorage.setItem("userId", OTAVIO);
    mockApi({ "GET /api/users": () => [200, users] });
    render(<App />);
    await screen.findByRole("table", { name: "Usuários cadastrados" });
    expect(window.location.pathname).toBe("/hr/users");
    expect(calls.some((call) => call.key === "GET /api/users")).toBe(true);
  });

  it("TK-12.01 RF-20: impede EMPLOYEE de abrir a área do RH", async () => {
    localStorage.setItem("userId", BEATRIZ);
    window.history.replaceState({}, "", "/hr/users");
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: /^Uma pausa/ });
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(calls.some((call) => call.key === "GET /api/users")).toBe(false);
  });
});

describe("TK-10.01 RF-09: página inicial do colaborador", () => {
  beforeEach(() => {
    localStorage.setItem("userId", BEATRIZ);
    window.history.replaceState({}, "", "/");
  });

  it("TK-10.01 RF-09: mostra a agenda de reservas e o acesso às dúvidas do RAG na página inicial", async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /Uma pausa no seu dia/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pergunte com base nos documentos oficiais/ })).toHaveAttribute(
      "href",
      "/chat",
    );
    expect(screen.getByRole("link", { name: "Ver todos os horários" })).toHaveAttribute("href", "#agenda");
    expect(await screen.findByRole("heading", { name: "Escolha o seu momento" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Terapeuta" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Dia" })).toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /api/booking/availability")).toBe(true);
    expect(calls.some((call) => call.key === "GET /api/booking/appointments/next")).toBe(false);
    await expectAccessible();
  });

  it("TK-10.01 RF-09: mostra estado vazio da agenda quando não há horários disponíveis", async () => {
    mockApi({ "GET /api/booking/availability": () => [200, { ...AVAILABILITY, slots: [] }] });
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /Uma pausa no seu dia/ })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhum horário livre nas próximas 3 semanas/)).toBeInTheDocument();
    await expectAccessible();
  });

  it("TK-10.01 RF-09: permite tentar novamente quando a agenda falha", async () => {
    let failed = true;
    mockApi({
      "GET /api/booking/availability": () =>
        failed ? [503, { message: "Não foi possível carregar a agenda." }] : [200, AVAILABILITY],
    });
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("radiogroup", { name: "Unidade" })).toBeInTheDocument();
    expect(calls.filter((call) => call.key === "GET /api/booking/availability")).toHaveLength(2);
    await expectAccessible();
  });

  it("TK-10.01 RF-09: abre o perfil em rota própria com título e foco no h1", async () => {
    mockApi();
    render(<App />);
    const profileLinks = await screen.findAllByRole("link", { name: "Meu perfil" });
    const profileLink = profileLinks.at(0);
    if (!profileLink) throw new Error("O link do perfil não foi encontrado.");
    await userEvent.click(profileLink);
    const heading = await screen.findByRole("heading", { level: 1, name: "Meu perfil" });
    await waitFor(() => expect(heading).toHaveFocus());
    await waitFor(() => expect(document.title).toBe("Meu perfil · Pausa"));
    expect(screen.getByRole("region", { name: "Dados do perfil" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Beatriz Lima")).toBeInTheDocument();
  });
});

it("TK-11.01 RF-30: abre a agenda para o papel massoterapeuta", async () => {
  localStorage.setItem("userId", MARINA);
  mockApi();
  render(<App />);
  await expectHeadingOnLoad("Agenda do massoterapeuta");
  const agendaRegion = await screen.findByRole("region", { name: "Agenda de hoje" });
  expect(await within(agendaRegion).findByText(THERAPIST_AGENDA.spokenText)).toBeInTheDocument();
  await expectAccessible();
});

describe("TK-09.04 RNF-01: roteamento por papel", () => {
  it.each([
    [BEATRIZ, "/", "Início · Pausa", "Uma pausa no seu dia, marcada em poucos segundos"],
    [MARINA, "/therapist", "Agenda do massoterapeuta · Pausa", "Agenda do massoterapeuta"],
    [RENATA, "/hr/users", "Usuários · Pausa", "Usuários"],
    [OTAVIO, "/admin", "Suporte · Pausa", "Suporte"],
  ])("TK-09.04: leva %s da página inicial para %s", async (userId, path, title, heading) => {
    localStorage.setItem("userId", userId);
    mockApi();
    render(<App />);
    await expectHeadingOnLoad(heading);
    expect(window.location.pathname).toBe(path);
    await waitFor(() => expect(document.title).toBe(title));
    await expectAccessible();
  });

  it.each([
    [
      MARINA,
      "/book",
      "/therapist",
      "Agenda do massoterapeuta",
      "A página que você abriu é da área de Colaborador; esta é a sua área.",
    ],
    [
      BEATRIZ,
      "/hr/users",
      "/",
      "Uma pausa no seu dia, marcada em poucos segundos",
      "A página que você abriu é da área de RH; esta é a sua área.",
    ],
  ])(
    "TK-09.04: leva %s que abre %s para a própria área, com uma frase explicando",
    async (userId, opened, home, heading, notice) => {
      localStorage.setItem("userId", userId);
      window.history.replaceState({}, "", opened);
      mockApi();
      render(<App />);
      const title = await screen.findByRole("heading", { level: 1, name: heading });
      expect(title).not.toHaveFocus();
      expect(window.location.pathname).toBe(home);
      expect(screen.getByText(notice)).toBeInTheDocument();
      await expectAccessible();
    },
  );

  it("TK-09.04 TK-12.01: deixa o suporte abrir a tela do RH, que ele também tem", async () => {
    localStorage.setItem("userId", OTAVIO);
    window.history.replaceState({}, "", "/hr");
    mockApi();
    render(<App />);
    await expectHeadingOnLoad("Usuários");
    expect(window.location.pathname).toBe("/hr/users");
    await waitFor(() => expect(document.title).toBe("Usuários · Pausa"));
    expect(
      await within(screen.getByRole("region", { name: "Usuários cadastrados" })).findByText(
        "Nenhum usuário encontrado.",
      ),
    ).toBeInTheDocument();
    await expectAccessible();
  });

  it("TK-09.04: explica que o QR Code é inválido e não chama a API quando o token está fora do formato", async () => {
    localStorage.setItem("userId", BEATRIZ);
    window.history.replaceState({}, "", "/check-in/%3Cscript%3E");
    mockApi();
    render(<App />);
    await expectHeadingOnLoad("Check-in");
    expect(screen.getByText(/^Este QR Code é inválido/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fazer check-in" })).not.toBeInTheDocument();
    expect(calls.some((c) => c.key.includes("check-in"))).toBe(false);
    await expectAccessible();
  });

  it("TK-09.04: volta ao QR Code aberto antes de entrar", async () => {
    window.history.replaceState({}, "", "/check-in/demo-sao-paulo-sala-1");
    mockApi({
      "POST /api/booking/check-in/demo-sao-paulo-sala-1": () => [
        200,
        { status: "CHECKED_IN", spokenText: "Check-in confirmado na Sala 1." },
      ],
    });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar como Beatriz Lima, Colaborador" }));
    await expectFocusedHeading("Check-in");
    expect(window.location.pathname).toBe("/check-in/demo-sao-paulo-sala-1");
    await expectAccessible();
  });

  it("TK-09.04: leva quem troca de usuário à escolha e depois à área do novo usuário, sem aviso", async () => {
    localStorage.setItem("userId", MARINA);
    mockApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: /Trocar de usuário/ }));
    await expectFocusedHeading("Entrar como…");
    await waitFor(() => expect(document.title).toBe("Entrar · Pausa"));
    await userEvent.click(await screen.findByRole("button", { name: "Entrar como Beatriz Lima, Colaborador" }));
    const home = await screen.findByRole("heading", {
      level: 1,
      name: "Uma pausa no seu dia, marcada em poucos segundos",
    });
    await waitFor(() => expect(home).toHaveFocus());
    expect(window.location.pathname).toBe("/");
    expect(screen.queryByText(/A página que você abriu/)).not.toBeInTheDocument();
    await expectAccessible();
  });
});

describe("TK-09.10 RN-04: página Acessibilidade", () => {
  it.each([
    [null, "/sign-in", "Entrar como…"],
    [BEATRIZ, "/", /^Uma pausa/],
    [BEATRIZ, "/check-in/sala-token", "Check-in"],
    [MARINA, "/therapist", "Agenda do massoterapeuta"],
    [RENATA, "/hr/users", "Usuários"],
    [null, "/accessibility", "Acessibilidade"],
  ])(
    "TK-09.10: com o usuário %s em %s, o primeiro destino após Pular para o conteúdo é Início",
    async (userId, path, heading) => {
      if (userId) localStorage.setItem("userId", userId);
      window.history.replaceState({}, "", path);
      mockApi();
      render(<App />);
      await expectHeadingOnLoad(heading);
      await userEvent.tab();
      expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveFocus();
      await userEvent.tab();
      expect(
        within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Início" }),
      ).toHaveFocus();
    },
  );

  it("TK-09.10: abre sem entrar, com título próprio e o foco no h1 ao seguir o link", async () => {
    mockApi();
    render(<App />);
    await expectHeadingOnLoad("Entrar como…");
    await userEvent.click(screen.getByRole("link", { name: "Acessibilidade" }));
    await expectFocusedHeading("Acessibilidade");
    expect(window.location.pathname).toBe("/accessibility");
    await waitFor(() => expect(document.title).toBe("Acessibilidade · Pausa"));
    expect(calls.some((c) => c.key === "GET /api/me")).toBe(false);
    await expectAccessible();
  });
});

describe("TK-09.04 RNF-01: foco e título a cada troca de rota", () => {
  beforeEach(() => localStorage.setItem("userId", BEATRIZ));

  it("TK-09.05 RNF-01: na carga da página deixa o foco no topo, e o primeiro Tab vai para Pular para o conteúdo", async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /^Uma pausa/ })).not.toHaveFocus();
    await waitFor(() => expect(document.title).toBe("Início · Pausa"));
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(document.getElementById("conteudo")).toHaveFocus();
  });

  it("TK-09.04: leva o foco ao h1 uma única vez e troca o título, inclusive ao voltar e avançar no navegador", async () => {
    window.history.replaceState({}, "", "/check-in/demo-sao-paulo-sala-1");
    mockApi();
    const focused: string[] = [];
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options) {
      if (this.tagName === "H1") focused.push(this.textContent ?? "");
      focus.call(this, options);
    });
    render(<App />);
    await expectHeadingOnLoad("Check-in");
    await waitFor(() => expect(document.title).toBe("Check-in · Pausa"));

    await userEvent.click(screen.getByRole("link", { name: "Voltar" }));
    const home = await screen.findByRole("heading", {
      level: 1,
      name: "Uma pausa no seu dia, marcada em poucos segundos",
    });
    await waitFor(() => expect(home).toHaveFocus());
    await waitFor(() => expect(document.title).toBe("Início · Pausa"));

    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Check-in" })).toHaveFocus());
    await waitFor(() => expect(document.title).toBe("Check-in · Pausa"));

    act(() => window.history.forward());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: /^Uma pausa/ })).toHaveFocus());
    await waitFor(() => expect(document.title).toBe("Início · Pausa"));

    expect(focused).toEqual([
      "Uma pausa no seu dia, marcada em poucos segundos",
      "Check-in",
      "Uma pausa no seu dia, marcada em poucos segundos",
    ]);
    expect(screen.getByRole("heading", { level: 1, name: /^Uma pausa/ }).closest("[aria-live]")).toBeNull();
    await expectAccessible();
  });

  it("TK-09.04: não tira o foco do link de pulo ao seguir um link para uma seção da mesma página", async () => {
    window.history.replaceState({}, "", "/check-in/demo-sao-paulo-sala-1");
    mockApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Voltar" }));
    const home = await screen.findByRole("heading", { level: 1, name: /^Uma pausa/ });
    await waitFor(() => expect(home).toHaveFocus());
    const main = screen.getByRole("main");
    act(() => {
      main.focus();
      window.history.pushState(null, "", "#conteudo");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(main).toHaveFocus();
  });
});
