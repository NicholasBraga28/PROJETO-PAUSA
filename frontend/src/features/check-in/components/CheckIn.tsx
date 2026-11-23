import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "react-aria-components";
import { QrCode } from "lucide-react";
import { errorMessage } from "@/shared/api/api-error";
import type { CheckInResult, Profile } from "@/shared/api/schemas";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { checkIn } from "@/features/check-in/api";

interface CheckInProps {
  profile: Profile;
  token: string | null;
}

export default function CheckIn({ profile, token }: CheckInProps) {
  const announce = useAnnounce();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<{ busy: boolean; result: CheckInResult | null; error: string | null }>({
    busy: false,
    result: null,
    error: null,
  });

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  async function confirm(roomToken: string) {
    setState({ busy: true, result: null, error: null });
    try {
      const result = await checkIn(roomToken);
      setState({ busy: false, result, error: null });
      announce(result.spokenText);
    } catch (err) {
      setState({ busy: false, result: null, error: errorMessage(err) });
    }
  }

  return (
    <main id="conteudo" className="page">
      <div className="page-in narrow">
        <QrCode className="w-8 h-8 accent" aria-hidden="true" />
        <h1 tabIndex={-1} className="display">
          Check-in
        </h1>
        {!token ? (
          <>
            <p className="lede">Este QR Code é inválido: leia de novo o QR Code impresso na porta da sala.</p>
            <Link className="ghost-btn" to="/">
              Ir para a página inicial
            </Link>
          </>
        ) : state.result ? (
          <>
            <p className="lede">{state.result.spokenText}</p>
            <Link className="ghost-btn" to="/">
              Ir para a página inicial
            </Link>
          </>
        ) : (
          <>
            <p className="lede">
              Confirme que você chegou à sala, {profile.firstName}. O terapeuta recebe o aviso na hora.
            </p>
            {state.error && (
              <p ref={errorRef} className="field-error" role="alert" tabIndex={-1}>
                {state.error}
              </p>
            )}
            <div className="row">
              <Button className="cta" onPress={() => confirm(token)} isDisabled={state.busy}>
                {state.busy ? "Confirmando…" : "Fazer check-in"}
              </Button>
              <Link className="ghost-btn" to="/">
                Voltar
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
