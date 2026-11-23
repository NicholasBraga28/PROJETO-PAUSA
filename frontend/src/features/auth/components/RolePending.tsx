import { Button } from "react-aria-components";
import { useProfile } from "@/features/auth/hooks/use-current-session";
import { useRouteState } from "@/features/auth/hooks/use-route-state";

interface RolePendingProps {
  roleLabel: string;
  onSwitch: () => void;
}

export default function RolePending({ roleLabel, onSwitch }: RolePendingProps) {
  const profile = useProfile();
  const { notice } = useRouteState();
  return (
    <main id="conteudo" className="page">
      <div className="page-in narrow">
        <span className="badge">{roleLabel}</span>
        <h1 tabIndex={-1} className="display">
          Olá, {profile.firstName}
        </h1>
        {notice && <p className="lede">{notice}</p>}
        <p className="lede">
          {profile.spokenText} Este site, por enquanto, é a área de reservas do colaborador. A tela do perfil{" "}
          {roleLabel} ainda não foi construída.
        </p>
        <Button className="cta" onPress={onSwitch}>
          Entrar com outro usuário
        </Button>
      </div>
    </main>
  );
}
