import { useRef, useState, type FormEvent } from "react";
import { Button, Label, Text, TextArea, TextField } from "react-aria-components";
import { ArrowUp, Bot, BookOpen, ShieldCheck, UserRound } from "lucide-react";
import { PauseAnimationButton } from "@/shared/visuals/PauseAnimationButton";
import LogoWire from "@/shared/visuals/LogoWire";
import { useScenePaused } from "@/shared/visuals/use-scene-paused";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { errorMessage } from "@/shared/api/api-error";
import { sendChatMessage } from "./api";

interface ChatTurn {
  id: number;
  question: string;
  status: "loading" | "answered" | "error";
  hasRetryControl?: boolean;
  answer?: string;
  sources: string[];
  suggestions: string[];
  error?: string;
}

function ChatPage() {
  const announce = useAnnounce();
  const [isScenePaused, setScenePaused] = useScenePaused();
  const nextTurnId = useRef(0);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sendingId, setSendingId] = useState<number | null>(null);

  async function send(message: string, existingTurnId?: number) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage || sendingId !== null) return false;

    const id = existingTurnId ?? nextTurnId.current++;
    setSendingId(id);
    if (existingTurnId === undefined) {
      setTurns((current) => [
        ...current,
        { id, question: normalizedMessage, status: "loading", sources: [], suggestions: [] },
      ]);
    } else {
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, status: "loading", hasRetryControl: true } : turn)),
      );
    }
    announce("Enviando sua pergunta ao assistente.");

    try {
      const result = await sendChatMessage(normalizedMessage);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                status: "answered",
                answer: result.answer,
                sources: result.sources,
                suggestions: result.suggestions,
                error: undefined,
              }
            : turn,
        ),
      );
      announce(result.answer);
      return true;
    } catch (cause: unknown) {
      const messageText = errorMessage(cause);
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, status: "error", error: messageText } : turn)),
      );
      return false;
    } finally {
      setSendingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question;
    if (await send(submittedQuestion)) setQuestion((current) => (current === submittedQuestion ? "" : current));
  }

  async function handleRetry(turn: ChatTurn) {
    await send(turn.question, turn.id);
  }

  return (
    <main id="conteudo" className="page booking-page chat-route">
      <header className="chat-intro chat-hero hero">
        <div aria-hidden="true" className="hero-logo absolute inset-0 pointer-events-none">
          <LogoWire className="w-full h-full" isPaused={isScenePaused} />
        </div>
        <div aria-hidden="true" className="hero-shield absolute inset-0 pointer-events-none" />
        <div className="chat-intro-copy chat-hero-copy hero-copy">
          <p className="chat-eyebrow">Um espaço para tirar dúvidas</p>
          <h1 className="hero-title" tabIndex={-1}>
            Assistente de dúvidas
          </h1>
          <p className="lede">
            Pergunte sobre reservas, horários e como usar o Pausa. Vou responder de forma clara e simples.
          </p>
        </div>
        <PauseAnimationButton isPaused={isScenePaused} onChange={setScenePaused} />
      </header>

      <div className="page-in narrow chat-page">
        <aside className="chat-privacy">
          <ShieldCheck size={22} aria-hidden="true" />
          <p>
            <strong>Privacidade em primeiro lugar</strong>
            <span>Não envie dados pessoais nem informações de agendamento.</span>
          </p>
        </aside>

        <section className="chat-panel" aria-labelledby="chat-conversation-heading" aria-busy={sendingId !== null}>
          <header className="chat-panel-heading">
            <h2 id="chat-conversation-heading">Conversa</h2>
          </header>
          {turns.length === 0 ? (
            <div className="chat-empty">
              <h3>Faça sua primeira pergunta</h3>
              <p>Escreva sua pergunta abaixo. Por exemplo: “Como funciona o cancelamento?”</p>
            </div>
          ) : (
            <ol className="chat-thread" aria-label="Mensagens da conversa" aria-live="off">
              {turns.map((turn) => (
                <li key={turn.id} className="chat-turn">
                  <article className="chat-turn-content">
                    <div className="chat-question-row">
                      <div className="chat-question-bubble">
                        <span className="chat-speaker">Você</span>
                        <h3 className="sr-only">Sua pergunta</h3>
                        <p className="chat-question-text">{turn.question}</p>
                      </div>
                      <span className="chat-user-mark" aria-hidden="true">
                        <UserRound size={18} />
                      </span>
                    </div>
                    <div className="chat-answer-row">
                      <span className="chat-assistant-mark" aria-hidden="true">
                        <Bot size={22} strokeWidth={1.8} />
                      </span>
                      <div className="chat-answer-content">
                        <span className="chat-speaker">Assistente</span>
                        <h3 className="sr-only">Resposta do assistente</h3>
                        {turn.status === "loading" ? <p className="chat-loading">Preparando a resposta…</p> : null}
                        {turn.status === "answered" ? (
                          <>
                            <p className="chat-answer-text">{turn.answer}</p>
                            {turn.sources.length > 0 ? (
                              <div className="chat-sources">
                                <h4>
                                  <BookOpen size={17} aria-hidden="true" /> Fontes consultadas
                                </h4>
                                <ul aria-label="Fontes consultadas">
                                  {turn.sources.map((source) => (
                                    <li key={source}>{source}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {turn.suggestions.length > 0 ? (
                              <div className="chat-suggestions">
                                <h4>Perguntas relacionadas</h4>
                                <ul aria-label="Perguntas relacionadas">
                                  {turn.suggestions.map((suggestion) => (
                                    <li key={suggestion}>
                                      <Button
                                        className="chat-suggestion"
                                        aria-disabled={sendingId !== null}
                                        onPress={() => void send(suggestion)}
                                      >
                                        {suggestion}
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {turn.error ? (
                          <div className="chat-error" role="alert">
                            <p>{turn.error}</p>
                          </div>
                        ) : null}
                        {turn.status === "answered" || turn.status === "error" || turn.error || turn.hasRetryControl ? (
                          <Button
                            className="ghost-btn chat-repeat"
                            aria-disabled={sendingId === turn.id}
                            onPress={() => void handleRetry(turn)}
                          >
                            {sendingId === turn.id
                              ? "Tentando novamente a pergunta…"
                              : turn.status === "error"
                                ? "Tentar novamente a pergunta"
                                : "Perguntar novamente"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}

          <form className="chat-composer" onSubmit={(event) => void handleSubmit(event)}>
            <TextField className="chat-field" value={question} onChange={setQuestion}>
              <Label className="chat-label">Sua pergunta</Label>
              <Text slot="description" id="chat-guidance" className="chat-guidance">
                Até 500 caracteres. Não inclua dados pessoais.
              </Text>
              <TextArea
                className="chat-input"
                rows={1}
                maxLength={500}
                aria-describedby="chat-guidance"
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
              />
            </TextField>
            <div className="chat-composer-action">
              {sendingId !== null ? <p className="chat-send-hint">Preparando sua resposta…</p> : null}
              <Button className="cta chat-send" type="submit" aria-disabled={sendingId !== null || !question.trim()}>
                {sendingId !== null ? "Enviando pergunta…" : "Enviar pergunta"}
                <ArrowUp size={19} aria-hidden="true" />
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ChatPage;
