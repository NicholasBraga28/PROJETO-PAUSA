import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { errorMessage } from "@/shared/api/api-error";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { BusinessRuleCard } from "./BusinessRuleCard";
import { getBusinessRules, updateBusinessRule, type BusinessRule } from "./api";
import { formatRuleValue, labelFor } from "./rule-format";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";
type PendingRule = { rule: BusinessRule; value: string };

export default function BusinessRulesPage() {
  const announce = useAnnounce();
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});
  const [pendingRule, setPendingRule] = useState<PendingRule | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    getBusinessRules().then(
      (result) => {
        if (!isCurrent) return;
        setRules(result);
        setLoadError(null);
        setLoadState("ready");
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setLoadError(errorMessage(error));
        setLoadState("error");
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [reload]);

  useEffect(() => {
    if (loadState === "error") errorRef.current?.focus();
  }, [loadState]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    setReload((current) => current + 1);
  }, []);

  const handleConfirm = async () => {
    if (!pendingRule) return;
    setActionBusy(true);
    setSuccessMessage(null);
    try {
      const updated = await updateBusinessRule(pendingRule.rule.key, pendingRule.value);
      setRules((current) => current.map((rule) => (rule.key === updated.key ? updated : rule)));
      setEditingKey(null);
      setRuleErrors((current) => ({ ...current, [updated.key]: "" }));
      setPendingRule(null);
      const message = `${labelFor(updated.key)} atualizado para ${formatRuleValue(updated.value, updated.type)}.`;
      setSuccessMessage(message);
      announce(message);
    } catch (error: unknown) {
      setRuleErrors((current) => ({ ...current, [pendingRule.rule.key]: errorMessage(error) }));
      setPendingRule(null);
    } finally {
      setActionBusy(false);
    }
  };

  const pendingTitle = pendingRule
    ? `Confirmar alteração de ${labelFor(pendingRule.rule.key)}?`
    : "Confirmar alteração?";

  return (
    <main id="conteudo" className="page hr-business-rules-page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Horários e limites de agendamento
          </h1>
          <p className="lede">Confira os horários e prazos que organizam os atendimentos.</p>
        </header>
        <section className="hr-panel hr-business-rules-panel" aria-labelledby="rules-list-title">
          <h2 id="rules-list-title">Ajustes dos atendimentos</h2>
          <p className="hr-help">Algumas configurações ainda estão em revisão.</p>
          {loadState === "loading" && (
            <p className="hr-state" role="status">
              Carregando configurações…
            </p>
          )}
          {loadState === "error" && loadError && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={errorRef}>
              <p>{loadError}</p>
              <Button className="cta" onPress={retry}>
                Tentar novamente
              </Button>
            </div>
          )}
          {loadState === "ready" && rules.length === 0 && <p className="hr-empty">Nenhum ajuste disponível agora.</p>}
          {loadState === "ready" && rules.length > 0 && (
            <ul className="hr-business-rules">
              {rules.map((rule) => (
                <li key={rule.key}>
                  <BusinessRuleCard
                    rule={rule}
                    isEditing={editingKey === rule.key}
                    draftValue={draftValue}
                    error={ruleErrors[rule.key] || null}
                    onEdit={() => {
                      setEditingKey(rule.key);
                      setDraftValue(rule.value);
                      setRuleErrors((current) => ({ ...current, [rule.key]: "" }));
                      setSuccessMessage(null);
                    }}
                    onCancel={() => {
                      setEditingKey(null);
                      setRuleErrors((current) => ({ ...current, [rule.key]: "" }));
                    }}
                    onDraftChange={(value) => {
                      setDraftValue(value);
                      setRuleErrors((current) => ({ ...current, [rule.key]: "" }));
                    }}
                    onReview={(value) => setPendingRule({ rule, value })}
                  />
                </li>
              ))}
            </ul>
          )}
          {successMessage && (
            <p className="hr-success" role="status">
              {successMessage}
            </p>
          )}
        </section>
        <ConfirmDialog
          isOpen={pendingRule !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen && !actionBusy) setPendingRule(null);
          }}
          title={pendingTitle}
          confirmLabel="Confirmar alteração"
          busyLabel="Salvando alteração…"
          onConfirm={handleConfirm}
          error={null}
          busy={actionBusy}
        >
          {pendingRule && (
            <>
              <p>{pendingRule.rule.description}</p>
              <p>Valor configurado: {formatRuleValue(pendingRule.rule.value, pendingRule.rule.type)}.</p>
              <p>Novo valor: {formatRuleValue(pendingRule.value, pendingRule.rule.type)}.</p>
              <p>Também vamos conferir se essa alteração combina com as demais configurações.</p>
            </>
          )}
        </ConfirmDialog>
      </div>
    </main>
  );
}
