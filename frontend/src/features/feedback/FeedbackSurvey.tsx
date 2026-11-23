import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Form, Label, Radio, RadioGroup, TextArea, TextField } from "react-aria-components";
import { errorMessage } from "@/shared/api/api-error";
import { submitFeedback, type SubmitFeedbackInput } from "@/features/feedback/api";
import { useAnnounce } from "@/shared/a11y/use-announce";

const QUESTIONS = [
  {
    key: "bookingEase",
    label: "Como você avalia a facilidade para realizar o agendamento pela plataforma?",
    options: [
      { value: 1, label: "Muito fácil" },
      { value: 2, label: "Fácil" },
      { value: 3, label: "Regular" },
      { value: 4, label: "Difícil" },
      { value: 5, label: "Muito difícil" },
    ],
  },
  {
    key: "technologySatisfaction",
    label: "Em relação à tecnologia, a plataforma atendeu às suas necessidades de uso e navegabilidade?",
    options: [
      { value: 1, label: "Atendeu totalmente" },
      { value: 2, label: "Atendeu em grande parte" },
      { value: 3, label: "Atendeu parcialmente" },
      { value: 4, label: "Não atendeu" },
    ],
  },
  {
    key: "serviceRating",
    label: "Como você avalia o serviço de massoterapia recebido?",
    options: [
      { value: 1, label: "Excelente" },
      { value: 2, label: "Bom" },
      { value: 3, label: "Regular" },
      { value: 4, label: "Ruim" },
      { value: 5, label: "Péssimo" },
    ],
  },
  {
    key: "recommendationScore",
    label: "De 0 a 10, o quanto você recomendaria nossa plataforma e serviços para um amigo ou familiar?",
    options: Array.from({ length: 11 }, (_, value) => ({ value, label: String(value) })),
  },
] as const;

type AnswerKey = (typeof QUESTIONS)[number]["key"];
type Answers = Partial<Record<AnswerKey, string>>;
const REQUIRED_MESSAGE = "Responda às quatro perguntas obrigatórias antes de enviar.";

export function FeedbackSurvey() {
  const announce = useAnnounce();
  const [isOpen, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [comment, setComment] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasAllAnswers = QUESTIONS.every(({ key }) => answers[key] !== undefined);
    if (!hasAllAnswers) {
      setError(REQUIRED_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(null);
    const input: SubmitFeedbackInput = {
      bookingEase: Number(answers.bookingEase),
      technologySatisfaction: Number(answers.technologySatisfaction),
      serviceRating: Number(answers.serviceRating),
      recommendationScore: Number(answers.recommendationScore),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };

    try {
      const result = await submitFeedback(input);
      setSubmitted(true);
      announce(result.spokenText);
    } catch (cause) {
      setError("Não foi possível enviar suas respostas. " + errorMessage(cause) + " Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="feedback-survey" aria-labelledby="feedback-survey-title">
      <h2 id="feedback-survey-title">Pesquisa de satisfação</h2>
      <p>Conte como foi sua experiência com a plataforma e com o atendimento.</p>
      <Button
        className="cta"
        aria-expanded={isOpen}
        aria-controls="feedback-survey-form"
        onPress={() => setOpen((value) => !value)}
      >
        {isOpen ? "Fechar pesquisa" : "Responder à pesquisa de satisfação"}
      </Button>
      {isOpen && (
        <div id="feedback-survey-form" className="feedback-survey-form">
          <h3>Plataforma de Agendamento de Massoterapia</h3>
          <p className="feedback-introduction">
            Olá! <span aria-hidden="true">😊</span> Queremos conhecer sua experiência com nossa plataforma de
            agendamento e com o atendimento de massoterapia. Sua opinião é muito importante para identificarmos
            melhorias e oferecermos uma experiência cada vez melhor. A pesquisa é rápida e leva apenas alguns minutos.
            Agradecemos pela sua participação!
          </p>
          <p className="feedback-privacy">
            Suas respostas não são vinculadas ao seu perfil nem a uma sessão. Você pode responder mais de uma vez. Evite
            incluir nomes, dados pessoais ou informações de saúde no comentário.
          </p>
          <Form className="feedback-form" onSubmit={handleSubmit} validationBehavior="aria">
            {QUESTIONS.map(({ key, label, options }) => (
              <fieldset className="feedback-question" key={key}>
                <legend>{label}</legend>
                <RadioGroup
                  className="feedback-options"
                  aria-label={label}
                  name={key}
                  isRequired
                  value={answers[key] ?? ""}
                  isInvalid={Boolean(error) && !answers[key]}
                  aria-describedby={error && !answers[key] ? "feedback-form-error" : undefined}
                  onChange={(value) => {
                    setAnswers((current) => ({ ...current, [key]: value }));
                    setError(null);
                  }}
                >
                  {options.map(({ value, label: optionLabel }) => (
                    <Radio key={value} value={String(value)} className="feedback-option">
                      {optionLabel}
                    </Radio>
                  ))}
                </RadioGroup>
              </fieldset>
            ))}
            <TextField className="feedback-comment" value={comment} onChange={setComment}>
              <Label>O que podemos fazer para melhorar sua experiência na plataforma ou no atendimento? (opcional)</Label>
              <TextArea rows={4} maxLength={1000} />
              <FieldError />
            </TextField>
            {error && (
              <p id="feedback-form-error" className="field-error feedback-error" role="alert" tabIndex={-1} ref={errorRef}>
                {error}
              </p>
            )}
            {submitted && <p className="feedback-thanks">Obrigado por fazer parte da construção do nosso projeto!</p>}
            <Button className="cta" type="submit" isDisabled={isSubmitting}>
              {isSubmitting ? "Enviando pesquisa…" : "Enviar pesquisa"}
            </Button>
          </Form>
        </div>
      )}
    </section>
  );
}
