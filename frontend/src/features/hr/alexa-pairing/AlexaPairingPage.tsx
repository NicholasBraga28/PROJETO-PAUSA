import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue, Label } from "react-aria-components";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { errorMessage } from "@/shared/api/api-error";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { generateAlexaPairingCode, getActiveTherapists } from "./api";
import { spokenPairingExpiry, spacedPairingDigits } from "./pairing-code";
import { HrNavigation } from "@/features/hr/HrNavigation";

type Therapist = { id: string; name: string };
type PairingCode = Awaited<ReturnType<typeof generateAlexaPairingCode>>;

export default function AlexaPairingPage() {
  const announce = useContext(AnnouncerContext);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const loadErrorRef = useRef<HTMLDivElement>(null);
  const selected = therapists.find(({ id }) => id === selectedTherapist);
  const expiry = pairingCode ? spokenPairingExpiry(pairingCode.expiresAt) : null;

  const loadTherapists = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTherapists(await getActiveTherapists());
    } catch (error: unknown) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    getActiveTherapists().then(
      (result) => {
        if (!isCurrent) return;
        setTherapists(result);
        setLoading(false);
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setLoadError(errorMessage(error));
        setLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (loadError) loadErrorRef.current?.focus();
  }, [loadError]);

  const confirmGeneration = async () => {
    if (!selectedTherapist) return;
    setBusy(true);
    setActionError(null);
    setActionStatus(null);
    setPairingCode(null);
    try {
      const result = await generateAlexaPairingCode(selectedTherapist);
      setPairingCode(result);
      setConfirmOpen(false);
      const message = `Código para conectar a Alexa: ${spacedPairingDigits(result.code)}. Válido até ${spokenPairingExpiry(result.expiresAt)}.`;
      setActionStatus(message);
      announce(message);
    } catch (error: unknown) {
      setActionError(errorMessage(error));
      announce(errorMessage(error), { urgent: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="conteudo" className="page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Conectar a Alexa
          </h1>
          <p className="lede">Gere um código temporário para conectar a Alexa ao perfil de um massoterapeuta.</p>
        </header>

        <section className="hr-panel alexa-pairing-panel" aria-labelledby="alexa-pairing-title">
          <h2 id="alexa-pairing-title">Gerar código de conexão</h2>
          {loading && (
            <p className="hr-state" role="status">
              Carregando massoterapeutas ativos…
            </p>
          )}
          {loadError && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={loadErrorRef}>
              <p>{loadError}</p>
              <Button className="cta" onPress={() => void loadTherapists()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!loading && !loadError && therapists.length === 0 && (
            <p className="hr-empty">Não há massoterapeutas ativos para conectar à Alexa.</p>
          )}
          {!loading && !loadError && therapists.length > 0 && (
            <div className="alexa-pairing-form">
              <Select
                className="hr-field"
                aria-label="Massoterapeuta"
                selectedKey={selectedTherapist}
                onSelectionChange={(key) => {
                  setSelectedTherapist(key === null ? null : String(key));
                  setPairingCode(null);
                  setActionStatus(null);
                  setActionError(null);
                }}
              >
                <Label>Massoterapeuta</Label>
                <Button className="hr-select-trigger">
                  <SelectValue>
                    {({ isPlaceholder, selectedText }) => (isPlaceholder ? "Selecione um massoterapeuta" : selectedText)}
                  </SelectValue>
                </Button>
                <Popover className="hr-select-popover">
                  <ListBox aria-label="Massoterapeutas ativos">
                    {therapists.map((therapist) => (
                      <ListBoxItem key={therapist.id} id={therapist.id}>
                        {therapist.name}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
              <p className="hr-help">O código tem seis dígitos e fica válido por 60 minutos.</p>
              {selected && (
                <Button className="cta" onPress={() => setConfirmOpen(true)}>
                  Gerar código de conexão
                </Button>
              )}
            </div>
          )}
          {pairingCode && expiry && (
            <section className="alexa-pairing-result" aria-labelledby="pairing-result-title">
              <h3 id="pairing-result-title">Código de {selected?.name}</h3>
              <ol className="alexa-pairing-digits" aria-label="Dígitos do código de conexão">
                {[...pairingCode.code].map((digit, index) => (
                  <li key={`${index}-${digit}`}>{digit}</li>
                ))}
              </ol>
              <p>
                Válido até <time dateTime={pairingCode.expiresAt}>{expiry}</time>.
              </p>
            </section>
          )}
          {actionStatus && (
            <p className="sr-only" role="status">
              {actionStatus}
            </p>
          )}
        </section>
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={(isOpen) => {
          if (!busy) {
            setConfirmOpen(isOpen);
            if (!isOpen) setActionError(null);
          }
        }}
        title="Gerar código de conexão?"
        confirmLabel="Confirmar geração"
        busyLabel="Gerando…"
        onConfirm={() => void confirmGeneration()}
        error={actionError}
        busy={busy}
        confirmClassName="cta"
      >
        <p>
          Será gerado um código para {selected?.name}.{" "}
          {pairingCode && "O código atual deixará de funcionar quando o novo for gerado."}
        </p>
      </ConfirmDialog>
    </main>
  );
}
