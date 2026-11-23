import type { ReactNode } from "react";

interface SectionProps {
  id: string;
  title: string;
  level?: 2 | 3;
  children: ReactNode;
}

function Section({ id, title, level = 2, children }: SectionProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className="a11y-section">
      <Heading id={id}>{title}</Heading>
      {children}
    </section>
  );
}

const STANDARDS = [
  "WCAG 2.2, nível AA em todas as telas, mais critérios AAA como contraste de 7:1 e alvos de 44 × 44 px",
  "ABNT NBR 17225:2025, a norma brasileira de acessibilidade web",
  "eMAG 3.1, o Modelo de Acessibilidade em Governo Eletrônico",
  "Lei Brasileira de Inclusão (Lei 13.146/2015, artigo 63)",
  "WAI-ARIA 1.2 e os padrões do ARIA Authoring Practices Guide",
];

export default function AccessibilityPage() {
  return (
    <main id="conteudo" className="page">
      <div className="page-in narrow a11y-page">
        <h1 tabIndex={-1} className="display">
          Acessibilidade
        </h1>
        <p className="lede">
          O Pausa foi feito para funcionar só com leitor de tela, só com teclado e com a tela ampliada. Aqui você
          encontra os recursos de acessibilidade, as normas que seguimos e os leitores de tela testados.
        </p>

        <Section id="resources" title="Recursos">
          <Section id="themes" title="Temas de cor" level={3}>
            <p>
              No topo de toda tela há o grupo Tema, com quatro opções: Automático, que segue o sistema; Claro; Escuro; e
              Alto contraste. Use as setas para trocar. A escolha fica guardada neste navegador. O modo de cores
              forçadas do Windows também é respeitado.
            </p>
          </Section>
          <Section id="region-shortcuts" title="Atalhos de região" level={3}>
            <p>
              O primeiro Tab de toda tela mostra o link Pular para o conteúdo, que leva direto ao conteúdo principal. O
              Tab seguinte chega ao link Acessibilidade, que traz você a esta página. Cada tela tem um único cabeçalho
              principal e seções com cabeçalho, para navegar pelos cabeçalhos com o leitor de tela.
            </p>
          </Section>
          <Section id="reduced-motion" title="Reduzir movimento" level={3}>
            <p>
              Se a opção de reduzir movimento estiver ligada no seu sistema, as animações de deslocamento ficam
              desligadas e a cena animada da página inicial começa pausada. O botão Pausar animação, junto da cena, para
              ou retoma a cena a qualquer momento, e a sua escolha fica guardada neste navegador.
            </p>
          </Section>
          <Section id="zoom" title="Zoom e tamanho do texto" level={3}>
            <p>
              Você pode ampliar a página até 400% sem precisar rolar para os lados. O texto acompanha o tamanho de fonte
              do navegador e do sistema, e o espaçamento entre letras, palavras e linhas pode ser aumentado sem quebrar
              a tela.
            </p>
          </Section>
        </Section>

        <Section id="standards" title="Normas seguidas">
          <ul>
            {STANDARDS.map((standard) => (
              <li key={standard}>{standard}</li>
            ))}
          </ul>
        </Section>

        <Section id="screen-readers" title="Leitores de tela testados">
          <p>
            Toda mudança nas telas é testada com o NVDA no Chrome e no Firefox, no Windows. Ao fim de cada etapa do
            projeto, testamos também com o Narrador, o VoiceOver e o TalkBack.
          </p>
        </Section>
      </div>
    </main>
  );
}
