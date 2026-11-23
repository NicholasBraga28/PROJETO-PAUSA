import { useProfile } from "@/features/auth/hooks/use-current-session";
import { ROLE_LABEL } from "@/features/auth/hooks/use-session";
import { ROLE_HOME } from "@/features/auth/auth-paths";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export default function ProfilePage() {
  const profile = useProfile();
  const roleLabel = ROLE_LABEL[profile.role];

  return (
    <main id="conteudo" className="page">
      <div className="page-in narrow user-profile">
        <header className="profile-intro">
          <h1 tabIndex={-1} className="display">
            Meu perfil
          </h1>
        </header>
        <section className="profile-card" aria-labelledby="profile-card-heading">
          <div className="profile-card-heading">
            <span className="profile-monogram" aria-hidden="true">
              {profile.firstName.slice(0, 1).toLocaleUpperCase("pt-BR")}
            </span>
            <h2 id="profile-card-heading">Dados do perfil</h2>
          </div>
          <dl className="profile-details">
            <div>
              <dt>Nome</dt>
              <dd>{profile.name}</dd>
            </div>
            <div>
              <dt>Perfil de acesso</dt>
              <dd>{roleLabel}</dd>
            </div>
          </dl>
        </section>
        <Link to={ROLE_HOME[profile.role]} className="ghost-btn profile-back">
          <ArrowLeft aria-hidden="true" />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
