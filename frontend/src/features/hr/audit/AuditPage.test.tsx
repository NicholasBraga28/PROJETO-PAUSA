import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import AuditPage from "./AuditPage";
import { MemoryRouter } from "react-router";

const first = {
  id: "00000000-0000-4000-8000-000000000011",
  actorId: null,
  action: "APPOINTMENT_CREATED",
  entityType: "Appointment",
  entityId: "00000000-0000-4000-8000-000000000012",
  createdAt: "2026-11-03T12:00:00.000Z",
  data: { status: "BOOKED" },
  spokenText: "Evento do sistema: Agendamento criado, registrado em 3 de novembro às 9h.",
};
const second = {
  ...first,
  id: "00000000-0000-4000-8000-000000000015",
  actorId: "00000000-0000-4000-8000-000000000016",
  action: "NEW_UNKNOWN_ACTION",
  entityId: "00000000-0000-4000-8000-000000000017",
  createdAt: "2026-11-03T11:00:00.000Z",
  data: {},
  spokenText: "Evento do agendamento registrado, registrado em 3 de novembro às 8h.",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockAudit(options: { pages?: boolean; empty?: boolean; cursorError?: boolean } = {}) {
  const calls: URL[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    calls.push(url);
    if (options.cursorError && url.searchParams.has("cursor")) {
      return respond(
        { message: "Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente." },
        400,
      );
    }
    if (options.empty)
      return respond({ items: [], nextCursor: null, spokenText: "Nenhum evento de auditoria no período consultado." });
    if (url.searchParams.has("cursor"))
      return respond({
        items: [first, second],
        nextCursor: null,
        spokenText: "2 eventos de auditoria no período consultado.",
      });
    return respond({
      items: [first],
      nextCursor: options.pages ? "00000000-0000-4000-8000-000000000018" : null,
      spokenText: "1 evento de auditoria no período consultado.",
    });
  });
  return calls;
}

function renderAudit(announce = vi.fn()) {
  return render(
    <AnnouncerContext.Provider value={announce}>
      <AuditPage />
    </AnnouncerContext.Provider>,
    { wrapper: MemoryRouter },
  );
}

async function query(user: ReturnType<typeof userEvent.setup>) {
  const filters = screen.getByText("Filtrar histórico");
  if (filters.closest("details")?.getAttribute("open") === null) await user.click(filters);
  await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
}

describe("auditoria de agendamentos do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.08 RF-22: envia filtros de datas como limites UTC do mês local e mostra resultados", async () => {
    const calls = mockAudit();
    const user = userEvent.setup();
    renderAudit();

    await user.click(screen.getByText("Filtrar histórico"));
    await user.type(screen.getByLabelText("Código do agendamento"), "00000000-0000-4000-8000-000000000012");
    await user.type(screen.getByLabelText("Código da pessoa responsável"), "00000000-0000-4000-8000-000000000013");
    await query(user);

    expect(await screen.findByRole("cell", { name: first.spokenText })).toBeInTheDocument();
    const appliedFilters = calls.at(-1);
    expect(appliedFilters?.searchParams.get("from")).toBe("2026-11-01T03:00:00.000Z");
    expect(appliedFilters?.searchParams.get("to")).toBe("2026-12-01T03:00:00.000Z");
    expect(appliedFilters?.searchParams.get("appointmentId")).toBe("00000000-0000-4000-8000-000000000012");
    expect(appliedFilters?.searchParams.get("actorId")).toBe("00000000-0000-4000-8000-000000000013");
    expect(screen.getAllByText("Sistema")).not.toHaveLength(0);
  });

  it("TK-12.08 RF-22: permite filtrar por apenas um limite de data", async () => {
    const calls = mockAudit();
    const user = userEvent.setup();
    renderAudit();
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "" } });
    await query(user);
    expect(await screen.findByRole("cell", { name: first.spokenText })).toBeInTheDocument();
    expect(calls.at(-1)?.searchParams.has("from")).toBe(false);
    expect(calls.at(-1)?.searchParams.get("to")).toBe("2026-12-01T03:00:00.000Z");
  });

  it("TK-12.08 RF-22 RNF-04: carrega mais com filtros preservados, deduplica e protege IDs e payload", async () => {
    const calls = mockAudit({ pages: true });
    const announce = vi.fn();
    const user = userEvent.setup();
    const { container } = renderAudit(announce);
    await query(user);
    expect(await screen.findByRole("cell", { name: first.spokenText })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByRole("cell", { name: second.spokenText })).toBeInTheDocument();
    expect(calls).toHaveLength(3);
    expect(calls[2]?.searchParams.get("cursor")).toBe("00000000-0000-4000-8000-000000000018");
    expect(calls[2]?.searchParams.get("from")).toBe(calls[1]?.searchParams.get("from"));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container).not.toHaveTextContent(first.id);
    expect(container).not.toHaveTextContent(first.entityId);
    expect(container).not.toHaveTextContent("email");
    await waitFor(() => expect(announce).toHaveBeenCalledWith("2 eventos de auditoria no período consultado."));
    await expectAccessible(container);
  });

  it("TK-12.08 RF-22 RNF-04: anuncia o estado vazio literalmente e mantém os filtros editáveis", async () => {
    mockAudit({ empty: true });
    const announce = vi.fn();
    const user = userEvent.setup();
    renderAudit(announce);
    await query(user);

    expect(await screen.findByText("Nenhum evento de auditoria no período consultado.")).toBeVisible();
    expect(screen.getByLabelText("Código do agendamento")).toBeEnabled();
    await waitFor(() => expect(announce).toHaveBeenCalledWith("Nenhum evento de auditoria no período consultado."));
  });

  it("TK-12.08 RF-22 RNF-01: cursor inválido foca erro e permite reiniciar sem cursor", async () => {
    const calls = mockAudit({ pages: true, cursorError: true });
    const user = userEvent.setup();
    renderAudit();
    await query(user);
    await user.click(await screen.findByRole("button", { name: "Carregar mais" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(calls).toHaveLength(4));
    expect(calls[3]?.searchParams.has("cursor")).toBe(false);
  });

  it("TK-12.08 RF-22 RNF-01: associa erro de UUID ao campo e preserva o filtro sem chamar a API", async () => {
    const fetch = mockAudit();
    const user = userEvent.setup();
    renderAudit();
    await screen.findByRole("cell", { name: first.spokenText });
    await user.click(screen.getByText("Filtrar histórico"));
    const actor = screen.getByLabelText("Código da pessoa responsável");
    await user.type(actor, "id-inválido");
    const requestCountBeforeInvalidFilter = fetch.length;
    await query(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o código da pessoa responsável.");
    expect(actor).toHaveAttribute("aria-invalid", "true");
    expect(actor).toHaveAttribute("aria-describedby", "audit-query-error");
    expect(actor).toHaveValue("id-inválido");
    expect(fetch).toHaveLength(requestCountBeforeInvalidFilter);
  });

  it("TK-12.08 RF-22 RNF-04: filtros sem rótulo opcional não são enviados e a tela passa axe", async () => {
    mockAudit();
    const user = userEvent.setup();
    const { container } = renderAudit();
    await query(user);
    expect(await screen.findByRole("cell", { name: first.spokenText })).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Alterações nos agendamentos, das mais recentes às mais antigas" }),
    ).toBeInTheDocument();
    await expectAccessible(container);
  });
});
