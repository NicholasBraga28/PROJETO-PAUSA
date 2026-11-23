import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import RoomsPage from "./RoomsPage";
import { MemoryRouter } from "react-router";

const rooms = [
  {
    id: "room-1",
    name: "Sala 1",
    locationId: "location-1",
    locationCode: "SAO_PAULO",
    active: true,
    checkInToken: "sensitive-check-in-token",
  },
];

const locations = [
  {
    id: "location-1",
    code: "SAO_PAULO",
    name: "São Paulo",
    timezone: "America/Sao_Paulo",
    active: true,
  },
  {
    id: "location-2",
    code: "LONDRINA",
    name: "Londrina",
    timezone: "America/Sao_Paulo",
    active: true,
  },
];

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockRoomApi() {
  const calls: Array<{ url: URL; method: string; body: unknown }> = [];
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (url.pathname === "/api/locations/admin") return respond(locations);
    if (url.pathname === "/api/rooms" && method === "GET") {
      return respond(url.searchParams.get("locationCode") === "LONDRINA" ? [] : rooms);
    }
    if (url.pathname === "/api/rooms" && method === "POST") {
      return respond(
        {
          id: "room-2",
          name: "Sala 2",
          locationId: "location-2",
          locationCode: "LONDRINA",
          active: true,
          checkInToken: "created-token",
        },
        201,
      );
    }
    if (url.pathname === "/api/rooms/room-1/regenerate-token") {
      return respond({ id: "room-1", name: "Sala 1", checkInToken: "new-token", updatedAt: "2026-11-03T12:00:00Z" });
    }
    return respond({ message: "Rota de teste não simulada." }, 404);
  });
  return { calls, fetch };
}

describe("tela de unidades e salas do RH", () => {
  it("TK-12.02 RF-24: apresenta salas e QR local com nome e instrução sem expor o token em texto", async () => {
    mockRoomApi();
    const { container } = render(<RoomsPage />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("heading", { name: "Sala 1" })).toBeVisible();
    expect(screen.getByRole("img", { name: "QR Code de check-in da Sala 1" })).toBeInTheDocument();
    expect(screen.getAllByText("Aponte a câmera do celular para fazer check-in nesta sala.")).toHaveLength(2);
    expect(screen.queryByText("sensitive-check-in-token")).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("TK-12.02 RF-24: informa quando não há salas cadastradas", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input), "http://localhost").pathname;
      return respond(path === "/api/locations/admin" ? locations : []);
    });
    render(<RoomsPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Nenhuma sala encontrada.")).toBeVisible();
  });

  it("TK-12.02 RF-24: consulta novamente ao filtrar por unidade", async () => {
    const { calls } = mockRoomApi();
    const user = userEvent.setup();
    render(<RoomsPage />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { name: "Sala 1" });

    await user.click(screen.getByRole("button", { name: /Unidade/ }));
    await user.click(await screen.findByRole("option", { name: "Londrina" }));

    expect(await screen.findByText("Nenhuma sala encontrada.")).toBeVisible();
    expect(calls.at(-1)?.url.searchParams.get("locationCode")).toBe("LONDRINA");
  });

  it("TK-12.02 RF-24: cria sala com unidade ativa depois de confirmar", async () => {
    const { calls } = mockRoomApi();
    const user = userEvent.setup();
    render(<RoomsPage />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { name: "Sala 1" });

    await user.click(screen.getByRole("button", { name: "Cadastrar sala" }));
    await user.type(screen.getByRole("textbox", { name: "Nome da sala" }), "Sala 2");
    await user.click(screen.getByRole("button", { name: /Unidade da sala/ }));
    await user.click(await screen.findByRole("option", { name: "Londrina" }));
    await user.click(screen.getByRole("button", { name: "Revisar cadastro da sala" }));
    expect(screen.getByRole("alertdialog", { name: "Cadastrar esta sala?" })).toBeVisible();
    expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/api/rooms")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Confirmar cadastro" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/api/rooms")).toBe(true),
    );
    expect(calls.find((call) => call.method === "POST" && call.url.pathname === "/api/rooms")?.body).toEqual({
      name: "Sala 2",
      locationId: "location-2",
    });
    expect(await screen.findByRole("img", { name: "QR Code de check-in da Sala 2" })).toBeInTheDocument();
  });

  it("TK-12.02 RF-24: explica a invalidação e só troca o QR depois de confirmar a regeneração", async () => {
    const { calls } = mockRoomApi();
    const user = userEvent.setup();
    render(<RoomsPage />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { name: "Sala 1" });

    await user.click(screen.getByRole("button", { name: "Regenerar QR Code da Sala 1" }));
    expect(
      screen.getByText("O QR Code atual deixará de funcionar. Confirme para gerar e mostrar um novo código."),
    ).toBeVisible();
    expect(calls.some((call) => call.url.pathname.endsWith("/regenerate-token"))).toBe(false);
    await user.click(screen.getByRole("button", { name: "Confirmar regeneração" }));

    expect(
      await screen.findByText("QR Code da Sala 1 atualizado. O código anterior deixou de funcionar."),
    ).toBeVisible();
    expect(
      calls.some((call) => call.method === "POST" && call.url.pathname === "/api/rooms/room-1/regenerate-token"),
    ).toBe(true);
  });

  it("TK-12.02 RF-24: imprime apenas o QR solicitado com o nome, unidade e instrução textual", async () => {
    mockRoomApi();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<RoomsPage />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { name: "Sala 1" });

    await user.click(screen.getByRole("button", { name: "Imprimir QR Code da Sala 1" }));

    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(screen.getByText("Unidade: São Paulo")).toBeInTheDocument();
    expect(screen.getAllByText("Aponte a câmera do celular para fazer check-in nesta sala.")).toHaveLength(2);
    window.dispatchEvent(new Event("afterprint"));
  });

  it("TK-12.02 RF-24: informa falha de consulta e permite tentar novamente", async () => {
    let shouldFail = true;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path === "/api/locations/admin") return respond(locations);
      if (shouldFail) {
        shouldFail = false;
        return respond({ message: "Falha temporária." }, 503);
      }
      return respond(rooms);
    });
    const user = userEvent.setup();
    render(<RoomsPage />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Sala 1" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
