import { useEffect, useRef, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import type { BusinessRule } from "./api";
import { formatRuleValue, inputHint, inputTypeFor, labelFor } from "./rule-format";

interface BusinessRuleCardProps {
  rule: BusinessRule;
  isEditing: boolean;
  draftValue: string;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onReview: (value: string) => void;
}

const idOf = (key: string) => key.toLocaleLowerCase("en-US").replaceAll("_", "-");

export function BusinessRuleCard({
  rule,
  isEditing,
  draftValue,
  error,
  onEdit,
  onCancel,
  onDraftChange,
  onReview,
}: BusinessRuleCardProps) {
  const label = labelFor(rule.key);
  const identifier = idOf(rule.key);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onReview(draftValue);
  };

  return (
    <section className="hr-business-rule" aria-labelledby={`rule-title-${identifier}`}>
      <div className="hr-rule-summary">
        <div className="hr-rule-copy">
          <h3 id={`rule-title-${identifier}`}>{label}</h3>
          <p>{rule.description}</p>
        </div>
        <div className="hr-rule-current">
          <span>Configurado</span>
          <strong>{formatRuleValue(rule.value, rule.type)}</strong>
        </div>
        {!isEditing && (
          <Button className="ghost-btn" onPress={onEdit}>
            Editar {label}
          </Button>
        )}
      </div>
      {isEditing && (
        <Form className="hr-rule-form" onSubmit={handleSubmit}>
          <TextField className="hr-field" isRequired value={draftValue} onChange={onDraftChange}>
            <Label>Novo valor para {label}</Label>
            <Input
              className="hr-input"
              type={inputTypeFor(rule.type)}
              step={inputTypeFor(rule.type) === "number" ? 1 : undefined}
              aria-describedby={`rule-description-${identifier}${error ? ` rule-error-${identifier}` : ""}`}
              aria-invalid={Boolean(error) || undefined}
            />
            <FieldError />
          </TextField>
          <p id={`rule-description-${identifier}`} className="hr-help">
            {inputHint(rule.type)}
          </p>
          {error && (
            <p id={`rule-error-${identifier}`} className="field-error" role="alert" tabIndex={-1} ref={errorRef}>
              {error} O valor salvo continua {formatRuleValue(rule.value, rule.type)}.
            </p>
          )}
          <div className="hr-form-actions">
            <Button type="submit" className="cta">
              Revisar alteração
            </Button>
            <Button type="button" className="ghost-btn" onPress={onCancel}>
              Cancelar edição de {label}
            </Button>
          </div>
        </Form>
      )}
    </section>
  );
}
