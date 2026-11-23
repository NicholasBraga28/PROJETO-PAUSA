import { useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { ChevronRight } from "lucide-react";
import type { DemoUser } from "@/shared/api/schemas";

interface SignInProps {
  users: DemoUser[] | null;
  error: string | null;
  onRetry: () => void;
  onPick: (userId: string) => Promise<void>;
  notice: string | null;
}

export default function SignIn({ users, error, onRetry, onPick, notice }: SignInProps) {
  const [picking, setPicking] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, DemoUser[]>();
    for (const u of users ?? []) map.set(u.roleLabel, [...(map.get(u.roleLabel) ?? []), u]);
    return [...map.entries()];
  }, [users]);

  async function pick(user: DemoUser) {
    setPicking(user.id);
    try {
      await onPick(user.id);
    } finally {
      setPicking(null);
    }
  }

  return (
    <main id="conteudo" className="page">
      <div className="page-in">
        <span className="badge">Modo de demonstração</span>
        <h1 tabIndex={-1} className="display">
          Entrar como…
        </h1>
        <p className="lede">
          Escolha quem vai usar o sistema. No protótipo não há senha: a escolha identifica você para a API.
        </p>

        {notice && (
          <p className="field-error" role="alert">
            {notice}
          </p>
        )}

        {!users ? (
          <div className="notice" role={error ? "alert" : "status"}>
            {error ? (
              <>
                <p>Não foi possível carregar os usuários: {error}</p>
                <Button className="ghost-btn" onPress={onRetry}>
                  Tentar de novo
                </Button>
              </>
            ) : (
              <p>Carregando usuários…</p>
            )}
          </div>
        ) : !users.length ? (
          <p className="notice" role="status">
            Nenhum usuário ativo. Rode o seed de demonstração no backend (npm run db:seed-demo).
          </p>
        ) : (
          <div className="people">
            {groups.map(([label, list]) => (
              <section key={label} aria-labelledby={`g-${label}`}>
                <h2 id={`g-${label}`} className="list-title">
                  {label}
                </h2>
                <ul className="person-list">
                  {list.map((u) => (
                    <li key={u.id}>
                      <Button
                        className="person"
                        onPress={() => pick(u)}
                        isDisabled={picking != null}
                        aria-label={`Entrar como ${u.name}, ${u.roleLabel}`}
                      >
                        <span className="avatar" aria-hidden="true" data-initial={u.firstName.charAt(0)} />
                        <span className="person-name">{u.name}</span>
                        <span className="person-state" aria-hidden="true">
                          {picking === u.id ? "Entrando…" : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
