import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest");
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

describe("PWA do massoterapeuta", () => {
  beforeEach(() => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("TK-11.05 RNF-01: declara manifesto, cor de tema e ícone da tela inicial no HTML", () => {
    expect(indexHtml).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"\s*\/>/);
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#5a179a"\s*\/>/);
    expect(indexHtml).toMatch(/<link rel="apple-touch-icon" sizes="180x180" href="\/icons\/icon-180\.png"\s*\/>/);
  });

  it("TK-11.05 RNF-01: configura nome em português e abre a rota da agenda em modo standalone", () => {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      id: "/therapist",
      start_url: "/therapist",
      scope: "/",
      name: "Pausa — Agenda do massoterapeuta",
      short_name: "Pausa",
      lang: "pt-BR",
      display: "standalone",
      theme_color: "#5a179a",
      background_color: "#f8f7fc",
    });
    expect(manifest).not.toHaveProperty("service_worker");
    expect(manifest).not.toHaveProperty("related_applications");
  });

  it("TK-11.05 RNF-01: fornece ícones PNG de 192 e 512 px com finalidade instalável", () => {
    const icons = [
      { path: "public/icons/icon-180.png", size: 180 },
      { path: "public/icons/icon-192.png", size: 192 },
      { path: "public/icons/icon-512.png", size: 512 },
      { path: "public/icons/icon-maskable-512.png", size: 512 },
    ];

    for (const { path, size } of icons) {
      const iconPath = resolve(process.cwd(), path);
      expect(existsSync(iconPath)).toBe(true);
      const icon = readFileSync(iconPath);
      expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(icon.readUInt32BE(16)).toBe(size);
      expect(icon.readUInt32BE(20)).toBe(size);
    }

    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    });
  });
});
