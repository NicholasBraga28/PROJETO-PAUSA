import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi, NOW, userIdOf, type Role } from "./fixtures/api";
import { movingElements } from "./support/motion";
import { walkWithTab } from "./support/keyboard";

interface Screen {
  name: string;
  path: string;
  role: Role | null;
  hasHeroScene: boolean;
  ready: (page: Page) => Promise<void>;
}

const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

const EMPLOYEE_HOME: Screen = {
  name: "Início do colaborador",
  path: "/",
  role: "EMPLOYEE",
  hasHeroScene: true,
  ready: async (page) => {
    await heading(page, /Uma pausa no seu dia/);
    await expect(page.getByRole("link", { name: /Pergunte com base nos documentos oficiais/ })).toHaveAttribute("href", "/chat");
    await expect(page.getByRole("link", { name: "Ver todos os horários" })).toHaveAttribute("href", "#agenda");
    await expect(page.getByRole("radiogroup", { name: "Unidade" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Terapeuta" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Dia" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /Hor.rio/ })).toBeVisible();
  },
};

const SCREENS: Screen[] = [
  {
    name: "Entrar como…",
    path: "/sign-in",
    role: null,
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Entrar como…");
      await expect(page.getByRole("button", { name: /Entrar como Ana Souza/ })).toBeVisible();
    },
  },
  {
    name: "Acessibilidade",
    path: "/accessibility",
    role: null,
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Acessibilidade");
      await expect(page.getByRole("region", { name: "Leitores de tela testados" })).toBeVisible();
    },
  },
  {
    name: "Assistente informativo",
    path: "/chat",
    role: null,
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Assistente de dúvidas");
      await expect(page.getByRole("heading", { level: 2, name: "Conversa" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Sua pergunta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Enviar pergunta" })).toBeDisabled();
    },
  },
  EMPLOYEE_HOME,
  {
    name: "Reserva do colaborador",
    path: "/book",
    role: "EMPLOYEE",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Reservar");
      await expect(page.getByRole("radiogroup", { name: "Unidade" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "Terapeuta" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "Dia" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: /Hor.rio/ })).toBeVisible();
    },
  },
  {
    name: "Sessões do colaborador",
    path: "/sessions",
    role: "EMPLOYEE",
    hasHeroScene: true,
    ready: async (page) => {
      await heading(page, "Suas sessões");
      await expect(page.getByRole("heading", { level: 2, name: "Próximas" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Anteriores" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Lista de espera" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Cancelar a sessão de/ })).toBeVisible();
      await expect(page.getByRole("list", { name: "Entradas da lista de espera" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Sair da lista de espera/ })).toBeVisible();
      await page.getByRole("button", { name: "Responder à pesquisa de satisfação" }).click();
      await expect(page.getByRole("radiogroup", { name: /facilidade para realizar o agendamento/ })).toBeVisible();
    },
  },
  {
    name: "Perfil do colaborador",
    path: "/profile",
    role: "EMPLOYEE",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Meu perfil");
      await expect(page.getByText("Ana Souza")).toBeVisible();
    },
  },
  {
    name: "Check-in",
    path: "/check-in/sala-1",
    role: "EMPLOYEE",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Check-in");
      await expect(page.getByRole("button", { name: "Fazer check-in" })).toBeVisible();
    },
  },
  {
    name: "Agenda do massoterapeuta",
    path: "/therapist",
    role: "THERAPIST",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Agenda do massoterapeuta");
      await expect(page.getByRole("region", { name: "Agora" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Próximo" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Agenda de hoje" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Atendimentos" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Horários" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Avisos" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Histórico de avisos" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Atendimentos de hoje" })).toBeVisible();
    },
  },
  {
    name: "Usuários do RH",
    path: "/hr/users",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Usuários");
      const table = page.getByRole("table", { name: "Usuários cadastrados" });
      const mobileList = page.getByRole("list", { name: "Usuários cadastrados" });
      if (await table.isVisible()) await expect(table).toBeVisible();
      else await expect(mobileList).toBeVisible();
      await expect(page.getByRole("button", { name: "Cadastrar usuário" })).toBeVisible();
    },
  },
  {
    name: "Unidades e salas do RH",
    path: "/hr/locations",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Unidades e salas");
      await expect(page.getByRole("button", { name: /Unidade/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Status/ })).toBeVisible();
      const roomsList = page.getByRole("list", { name: "Salas cadastradas" });
      await expect(roomsList).toBeVisible();
      await expect(roomsList.getByRole("heading", { name: "Sala 1" })).toBeVisible();
    },
  },
  {
    name: "Agendas do RH",
    path: "/hr/schedules",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Agendas diárias");
      await expect(page.getByRole("button", { name: "Buscar agenda" })).toBeVisible();
      if (await page.evaluate(() => innerWidth <= 320)) {
        await expect(page.getByRole("list", { name: "Períodos da agenda" })).toBeVisible();
      } else {
        await expect(page.getByRole("table", { name: "Períodos da agenda" })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "Adicionar período" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Copiar um dia modelo" })).toBeVisible();
    },
  },
  {
    name: "Bloqueios do RH",
    path: "/hr/blocks",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Horários sem atendimento");
      await expect(page.getByRole("button", { name: /Massoterapeuta/ })).toBeVisible();
      await expect(page.getByLabel("Início")).toBeVisible();
      await expect(page.getByLabel("Fim")).toBeVisible();
      await expect(page.getByRole("button", { name: "Revisar período" })).toBeVisible();
    },
  },
  {
    name: "Regras de negócio do RH",
    path: "/hr/rules",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Horários e limites de agendamento");
      await expect(page.getByRole("heading", { name: "Ajustes dos atendimentos" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Duração da sessão" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Editar Duração da sessão" })).toBeVisible();
    },
  },
  {
    name: "Pareamento da Alexa do RH",
    path: "/hr/alexa-pairing",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Conectar a Alexa");
      await expect(page.getByRole("button", { name: /Massoterapeuta/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Gerar código de conexão" })).toBeVisible();
    },
  },
  {
    name: "Relatórios e KPIs do RH",
    path: "/hr/reports",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Relatórios de atendimento");
      await expect(page.getByRole("button", { name: /Mês anterior/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Indicadores do mês" })).toBeVisible();
      await page.getByRole("button", { name: /Mês anterior/ }).click();
      await expect(page.getByRole("heading", { name: "Indicadores do mês" })).toBeVisible();
      await expect(page.getByText("Ver tendência por dia da semana")).toBeVisible();
      const weekdayDetails = page.locator("details.hr-kpi-details > summary").nth(1);
      await weekdayDetails.click();
      await expect(page.locator(".hr-kpi-line-chart").nth(1)).toBeVisible();
      await expect(page.getByRole("table", { name: "Agendamentos por dia da semana" })).toBeHidden();
      await page.locator("details.hr-kpi-details").nth(1).locator("details.hr-kpi-table-details > summary").click();
      await expect(page.getByRole("table", { name: "Agendamentos por dia da semana" })).toBeVisible();
      await page.locator("details.hr-kpi-details").nth(1).locator("details.hr-kpi-table-details > summary").click();
      await weekdayDetails.click();
      const detailsToggle = page.locator("details.hr-kpi-details > summary").nth(2);
      await detailsToggle.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".hr-kpi-line-chart").nth(2)).toBeVisible();
      const detailsTableToggle = page
        .locator("details.hr-kpi-details")
        .nth(2)
        .locator("details.hr-kpi-table-details > summary");
      await detailsTableToggle.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("table", { name: "Agendamentos por horário de início" })).toBeVisible();
      await page.keyboard.press("Enter");
      await detailsToggle.focus();
      await page.keyboard.press("Enter");
      const feedback = page.getByRole("region", { name: /Pesquisa de satis/ });
      await expect(feedback.getByText(/3 respostas/)).toBeVisible();
      await expect(feedback.getByRole("table", { name: /facilidade para realizar o agendamento/ })).toBeVisible();
      await expect(feedback.getByRole("list", { name: /Coment/ })).toHaveCount(1);
    },
  },
  {
    name: "Auditoria de agendamentos do RH",
    path: "/hr/audit",
    role: "HR",
    hasHeroScene: false,
    ready: async (page) => {
      await heading(page, "Histórico de alterações");
      const visibleEvent = page.locator(".audit-table tbody tr:visible, .audit-cards li:visible").first();
      await expect(visibleEvent).toContainText("Agendamento criado");
      await expect(visibleEvent).toContainText("Sistema");
      if ((page.viewportSize()?.width ?? 1280) <= 672) {
        await expect(page.locator(".audit-cards li:visible")).toHaveCount(1);
      } else {
      await expect(page.getByRole("table", { name: /Alterações nos agendamentos/ })).toBeVisible();
      }
    },
  },
];

const THEME_LABEL = { light: "claro", dark: "escuro", contrast: "alto contraste" } as const;
type Theme = keyof typeof THEME_LABEL;
const THEMES: Theme[] = ["light", "dark", "contrast"];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"];
const SETTLE_MS = 2_000;
const ZOOM_400_VIEWPORT = { width: 320, height: 640 };
const MIN_TARGET_PX = 44;

interface OpenOptions {
  isScenePaused?: boolean;
}

async function openScreen(page: Page, screen: Screen, theme: Theme, { isScenePaused = true }: OpenOptions = {}) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ theme, userId, isScenePaused }) => {
      localStorage.setItem("theme", theme);
      if (isScenePaused) localStorage.setItem("scene-paused", "true");
      if (userId) localStorage.setItem("userId", userId);
    },
    { theme, userId: screen.role ? userIdOf(screen.role) : null, isScenePaused },
  );
  await mockApi(page);
  await page.goto(screen.path);
  await screen.ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function revealAll(page: Page) {
  await page.evaluate(async () => {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (let top = 0; top <= document.documentElement.scrollHeight; top += innerHeight / 2) {
      window.scrollTo({ top, behavior: "instant" });
      await nextFrame();
      await nextFrame();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(SETTLE_MS);
}

interface AxeOptions {
  isForcedColors?: boolean;
}

async function expectNoViolations(page: Page, { isForcedColors = false }: AxeOptions = {}) {
  const contrastRulesUnlessForcedColors = {
    "color-contrast": { enabled: !isForcedColors },
    "color-contrast-enhanced": { enabled: !isForcedColors },
  };
  const results = await new AxeBuilder({ page })
    .options({ rules: contrastRulesUnlessForcedColors })
    .withTags(WCAG_TAGS)
    .analyze();
  const ranRules = [...results.passes, ...results.violations, ...results.incomplete].map((rule) => rule.id);
  if (!isForcedColors) expect(ranRules, "a regra AAA de contraste precisa rodar").toContain("color-contrast-enhanced");
  const report = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes.map((node) => node.target.join(" ")).join("\n  ")}`,
  );
  expect(report).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, viewportWidth, overflowing } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        element: `${element.tagName.toLowerCase()}.${element.className.toString()}`,
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter(({ right }) => right > innerWidth + 1)
      .sort((first, second) => second.right - first.right)
      .slice(0, 5),
  }));
  expect(scrollWidth, `rolagem horizontal (reflow, 1.4.10): ${JSON.stringify(overflowing)}`).toBeLessThanOrEqual(
    viewportWidth,
  );
}

async function expectTabReachesEveryControlWithVisibleFocus(page: Page) {
  const { stops, unreached } = await walkWithTab(page);
  expect(stops.length).toBeGreaterThan(0);
  expect(
    stops.filter((stop) => !stop.isFocusVisible).map((stop) => stop.name),
    "sem foco visível",
  ).toEqual([]);
  expect(
    stops.filter((stop) => !stop.isInDomOrder).map((stop) => stop.name),
    "fora da ordem do DOM",
  ).toEqual([]);
  expect(unreached, "controles que o Tab não alcança").toEqual([]);
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    for (const theme of THEMES) {
      test.describe(`tema ${THEME_LABEL[theme]}`, () => {
        test("RN-04: axe sem violações (A, AA, boas práticas e contraste AAA)", async ({ page }) => {
          await openScreen(page, screen, theme);
          await revealAll(page);
          await expectNoViolations(page);
        });

        test("RN-04: só com Tab, todo controle recebe foco visível, na ordem do DOM", async ({ page }) => {
          await openScreen(page, screen, theme);
          await expectTabReachesEveryControlWithVisibleFocus(page);
        });

        test.describe("a 320 px (zoom de 400%)", () => {
          test.use({ viewport: ZOOM_400_VIEWPORT });
          test("RN-04: sem violações e sem rolagem horizontal", async ({ page }) => {
            await openScreen(page, screen, theme);
            await revealAll(page);
            await expectNoViolations(page);
            await expectNoHorizontalScroll(page);
          });
        });

        test.describe("com cores forçadas", () => {
          test.use({ forcedColors: "active" });
          test("RN-04: sem violações e sem rolagem horizontal", async ({ page }) => {
            await openScreen(page, screen, theme);
            await revealAll(page);
            await expectNoViolations(page, { isForcedColors: true });
            await expectNoHorizontalScroll(page);
          });

          test("RN-04: só com Tab, todo controle recebe foco visível", async ({ page }) => {
            await openScreen(page, screen, theme);
            await expectTabReachesEveryControlWithVisibleFocus(page);
          });
        });

        test.describe("com movimento reduzido", () => {
          test.use({ reducedMotion: "reduce" });
          test("RN-04: sem violações, sem rolagem horizontal e nenhuma animação de deslocamento", async ({ page }) => {
            await openScreen(page, screen, theme, { isScenePaused: false });
            if (screen.hasHeroScene)
              await expect(page.getByRole("button", { name: "Pausar animação" })).toHaveAttribute(
                "aria-pressed",
                "true",
              );
            expect(await movingElements(page)).toEqual([]);
            await revealAll(page);
            await expectNoViolations(page);
            await expectNoHorizontalScroll(page);
          });
        });
      });
    }
  });
}

test("TK-09.08: o detector de movimento acusa as animações quando o movimento não é reduzido", async ({ page }) => {
  await openScreen(page, EMPLOYEE_HOME, "light");
  expect((await movingElements(page)).length).toBeGreaterThan(0);
});

test("TK-15.03 RF-34 RN-04: envia pergunta por teclado, apresenta fontes e anuncia a resposta", async ({ page }) => {
  const chatScreen = SCREENS.find(({ name }) => name === "Assistente informativo");
  if (!chatScreen) throw new Error("A tela do assistente precisa estar cadastrada.");
  await openScreen(page, chatScreen, "light");
  const question = page.getByRole("textbox", { name: "Sua pergunta" });
  const submit = page.getByRole("button", { name: "Enviar pergunta" });
  const initialSubmitBox = await submit.boundingBox();
  await question.fill("Como funciona o cancelamento?");
  const filledSubmitBox = await submit.boundingBox();
  if (!initialSubmitBox || !filledSubmitBox) throw new Error("O botão de envio precisa estar visível.");
  expect(filledSubmitBox.x + filledSubmitBox.width).toBeCloseTo(initialSubmitBox.x + initialSubmitBox.width);
  await question.press("Enter");
  await expect(
    page
      .getByRole("list", { name: "Mensagens da conversa" })
      .getByText("O cancelamento segue as regras oficiais do sistema."),
  ).toBeVisible();
  await expect(question).toBeFocused();
  await expect(page.getByRole("heading", { name: "Fontes consultadas" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Fontes consultadas" })).toContainText("requisitos.md");
  await expect(page.getByRole("status")).toContainText("O cancelamento segue as regras oficiais do sistema.");
  await expectNoViolations(page);
});

test("TK-15.04 RF-34 RN-04 RNF-04: mantém foco e pergunta após indisponibilidade e tenta novamente sem identificar a pessoa", async ({
  page,
}) => {
  const chatScreen = SCREENS.find(({ name }) => name === "Assistente informativo");
  if (!chatScreen) throw new Error("A tela do assistente precisa estar cadastrada.");
  await openScreen(page, chatScreen, "light");
  const requests: { message: string; userId: string | undefined }[] = [];
  await page.route("**/api/chat/messages", async (route) => {
    const payload: unknown = route.request().postDataJSON();
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "";
    requests.push({ message, userId: route.request().headers()["x-user-id"] });
    if (requests.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Falha interna privada." }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "Consulte as regras oficiais.",
        topic: "rag",
        sources: ["requisitos.md"],
        suggestions: [],
      }),
    });
  });

  const question = page.getByRole("textbox", { name: "Sua pergunta" });
  await question.fill("Como funciona o cancelamento?");
  const submit = page.getByRole("button", { name: "Enviar pergunta" });
  await submit.focus();
  await page.keyboard.press("Enter");

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText("Falha interna privada.");
  await expect(question).toHaveValue("Como funciona o cancelamento?");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const retry = page.getByRole("button", { name: "Tentar novamente a pergunta" });
  await expect(retry).toBeFocused();
  await retry.press("Enter");
  await expect(
    page.getByRole("list", { name: "Mensagens da conversa" }).getByText("Consulte as regras oficiais."),
  ).toBeVisible();
  await expect(question).toHaveValue("Como funciona o cancelamento?");
  await expect(page.getByRole("button", { name: "Perguntar novamente" })).toBeFocused();
  expect(requests).toEqual([
    { message: "Como funciona o cancelamento?", userId: undefined },
    { message: "Como funciona o cancelamento?", userId: undefined },
  ]);
  await expectNoViolations(page);
});

test("TK-11.03 RF-31: marca aviso como lido por teclado e mantém o foco no histórico", async ({ page }) => {
  const therapistScreen = SCREENS.find(({ name }) => name === "Agenda do massoterapeuta");
  if (!therapistScreen) throw new Error("A tela do massoterapeuta precisa estar cadastrada.");
  await openScreen(page, therapistScreen, "light");
  const markRead = page.getByRole("button", { name: "Marcar como lido: Ana chegou para o atendimento atual." });
  await markRead.focus();
  await page.keyboard.press("Enter");
  const readButton = page.getByRole("button", { name: "Lido. Aviso: Ana chegou para o atendimento atual." });
  await expect(readButton).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Aviso marcado como lido.");
  await expect(page.getByRole("listitem").filter({ hasText: "Ana chegou para o atendimento atual." })).toBeVisible();
  await expectNoViolations(page);
});

test("TK-11.04 RNF-01: mantém estados e ações compreensíveis sob simulação de daltonismo", async ({ page }) => {
  const therapistScreen = SCREENS.find(({ name }) => name === "Agenda do massoterapeuta");
  if (!therapistScreen) throw new Error("A tela do massoterapeuta precisa estar cadastrada.");
  await openScreen(page, therapistScreen, "light");
  const cdp = await page.context().newCDPSession(page);
  const deficiencyTypes = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"] as const;

  for (const type of deficiencyTypes) {
    await cdp.send("Emulation.setEmulatedVisionDeficiency", { type });
    await expect(page.getByText(/Não lido/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Marcar como lido: Ana chegou para o atendimento atual." }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Avisos" })).toBeVisible();
  }

  await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: "none" });
  await expectNoViolations(page);
});

test("TK-11.05 RNF-01: instala com manifesto válido e abre diretamente a agenda sem service worker", async ({
  page,
}) => {
  const therapistScreen = SCREENS.find(({ name }) => name === "Agenda do massoterapeuta");
  if (!therapistScreen) throw new Error("A tela do massoterapeuta precisa estar cadastrada.");
  await openScreen(page, therapistScreen, "light");

  const manifestResponse = await page.request.get(new URL("/manifest.webmanifest", page.url()).toString());
  expect(manifestResponse.ok()).toBe(true);
  const manifest: unknown = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/therapist",
    start_url: "/therapist",
    display: "standalone",
    short_name: "Pausa",
  });
  await expect(page).toHaveURL(/\/therapist$/);
  await expect(page.getByRole("heading", { level: 1, name: "Agenda do massoterapeuta" })).toBeVisible();
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations())?.length ?? 0)).toBe(0);
  await expectNoViolations(page);
});

test("TK-11.02 RF-12 RF-13 RN-13: ações são operáveis por teclado e confirmadas após prévia", async ({ page }) => {
  const therapistScreen = SCREENS.find(({ name }) => name === "Agenda do massoterapeuta");
  if (!therapistScreen) throw new Error("A tela do massoterapeuta precisa estar cadastrada.");
  await openScreen(page, therapistScreen, "light");
  await page.route("**/api/therapists/me/appointments/appointment-next/cancel", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        appointmentId: "appointment-next",
        status: "CANCELLED",
        spokenText: "Atendimento cancelado.",
      }),
    }),
  );
  await page.route("**/api/therapists/me/schedule-blocks/preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ confirmationText: "Bloquear 5 de novembro, das 9h às 10h. Confirma?" }),
    }),
  );
  await page.route("**/api/therapists/me/schedule-blocks", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "block-1",
        startsAt: "2026-11-05T12:00:00.000Z",
        endsAt: "2026-11-05T13:00:00.000Z",
        reason: null,
        spokenText: "Horário bloqueado.",
      }),
    }),
  );

  const cancel = page.getByRole("button", { name: "Cancelar atendimento de Bia, às 11h30" });
  await cancel.focus();
  await page.keyboard.press("Enter");
  const cancelDialog = page.getByRole("alertdialog", { name: "Cancelar o atendimento de Bia às 11h30. Confirma?" });
  await expect(cancelDialog).toBeVisible();
  await expect(cancelDialog.getByRole("button", { name: "Voltar" })).toBeFocused();
  await expectNoViolations(page);
  await page.keyboard.press("Escape");
  await expect(cancel).toBeFocused();

  await cancel.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Confirmar cancelamento" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Atendimento cancelado.");
  await expect(page.getByRole("region", { name: "Atendimentos" })).toBeFocused();

  await page.getByLabel("Início").fill("2026-11-05T09:00");
  await page.getByLabel("Fim").fill("2026-11-05T10:00");
  const review = page.getByRole("button", { name: "Revisar período" });
  await review.focus();
  await page.keyboard.press("Enter");
  const blockDialog = page.getByRole("alertdialog", { name: "Bloquear 5 de novembro, das 9h às 10h. Confirma?" });
  await expect(blockDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(blockDialog).toBeVisible();
  await expect(blockDialog.getByRole("button", { name: "Voltar" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Confirmar período" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Horário bloqueado.");
});

test("TK-16.04 RF-34 RN-18: suporte pode consultar resultados anônimos sem navegação de RH", async ({ page }) => {
  const supportReportsScreen: Screen = {
    name: "Relatórios de satisfação para suporte",
    path: "/hr/reports",
    role: "ADMIN",
    hasHeroScene: false,
    ready: async (currentPage) => {
      await heading(currentPage, "Relatórios de atendimento");
      await expect(currentPage.getByRole("region", { name: "Pesquisa de satisfação" })).toBeVisible();
      await expect(currentPage.getByRole("navigation", { name: "Navegação do suporte" })).toBeVisible();
    },
  };
  await openScreen(page, supportReportsScreen, "light");

  await expect(page.getByRole("link", { name: "Suporte" })).toHaveAttribute("href", "/admin");
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
});

async function openFeedbackSurvey(page: Page, theme: Theme) {
  const sessionsScreen = SCREENS.find(({ name }) => name === "Sessões do colaborador");
  if (!sessionsScreen) throw new Error("A tela de sessões precisa estar cadastrada.");
  await openScreen(page, sessionsScreen, theme);
  return page.getByRole("radiogroup", { name: /facilidade para realizar o agendamento/ });
}

for (const theme of THEMES) {
  test(`TK-16.03 RF-34 RN-04: no tema ${THEME_LABEL[theme]}, a resposta escolhida muda na tela e a opção tem alvo mínimo`, async ({
    page,
  }) => {
    const group = await openFeedbackSurvey(page, theme);
    const option = group.locator("label", { hasText: "Muito fácil" });
    const unselectedBackground = await option.evaluate((element) => getComputedStyle(element).backgroundColor);

    await option.click();

    await expect(group.getByRole("radio", { name: "Muito fácil" })).toBeChecked();
    await expect(option).not.toHaveCSS("background-color", unselectedBackground);
    const box = await option.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    await expectNoViolations(page);

    await page.emulateMedia({ forcedColors: "active" });
    await expect(option).toHaveCSS("outline-style", "solid");
  });
}

test("TK-16.03 RF-34 RN-04: a opção alcançada pelo teclado mostra o contorno de foco", async ({ page }) => {
  const group = await openFeedbackSurvey(page, "light");
  await group.getByRole("radio", { name: "Muito fácil" }).focus();

  await page.keyboard.press("ArrowDown");

  await expect(group.getByRole("radio", { name: "Fácil", exact: true })).toBeChecked();
  await expect(group.locator("label", { hasText: /^Fácil$/ })).toHaveCSS("outline-style", "solid");
});
