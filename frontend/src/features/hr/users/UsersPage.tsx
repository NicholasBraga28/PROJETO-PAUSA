import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { errorMessage } from "@/shared/api/api-error";
import { Role, UserStatus, type Role as UserRole, type User, type UserStatus as UserState } from "@/shared/api/schemas";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { createUser, getUsers, updateUserStatus, type NewUser, type UserFilters } from "./api";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";
type PendingAction = { kind: "create"; input: NewUser } | { kind: "status"; user: User; status: UserState };

const ROLE_LABEL: Record<UserRole, string> = {
  EMPLOYEE: "Colaborador",
  THERAPIST: "Massoterapeuta",
  HR: "RH",
  ADMIN: "Suporte",
};

const STATUS_LABEL: Record<UserState, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo" };
const ROLE_OPTIONS = [
  { id: "all", label: "Todos os papéis" },
  ...Role.options.map((role) => ({ id: role, label: ROLE_LABEL[role] })),
];
const STATUS_OPTIONS = [
  { id: "all", label: "Todos os status" },
  ...UserStatus.options.map((status) => ({ id: status, label: STATUS_LABEL[status] })),
];

interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <Select
      className="hr-field"
      selectedKey={value || "all"}
      onSelectionChange={(key) => {
        const selected = options.find((option) => option.id === key);
        if (selected) onChange(selected.id === "all" ? "" : selected.id);
      }}
    >
      <Label>{label}</Label>
      <Button className="hr-select-trigger">
        <SelectValue />
      </Button>
      <Popover className="hr-select-popover">
        <ListBox aria-label={label}>
          {options.map((option) => (
            <ListBoxItem key={option.id} id={option.id}>
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

interface UsersFiltersProps {
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}

function UsersFilters({ filters, onFiltersChange, onSearch }: UsersFiltersProps) {
  return (
    <Form className="hr-filters" onSubmit={onSearch}>
      <FilterSelect
        label="Papel"
        value={filters.role}
        options={ROLE_OPTIONS}
        onChange={(role) => onFiltersChange({ ...filters, role: Role.safeParse(role).success ? Role.parse(role) : "" })}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(status) =>
          onFiltersChange({ ...filters, status: UserStatus.safeParse(status).success ? UserStatus.parse(status) : "" })
        }
      />
      <TextField
        className="hr-field hr-search"
        value={filters.search}
        onChange={(search) => onFiltersChange({ ...filters, search })}
      >
        <Label>Nome ou e-mail</Label>
        <Input className="hr-input" autoComplete="off" />
      </TextField>
      <Button type="submit" className="cta hr-filter-button">
        Buscar usuários
      </Button>
    </Form>
  );
}

interface UserFormProps {
  onSubmit: (input: NewUser) => void;
  onCancel: () => void;
  isDisabled: boolean;
}

function UserForm({ onSubmit, onCancel, isDisabled }: UserFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYEE");

  return (
    <section className="hr-create" aria-labelledby="new-user-title">
      <h2 id="new-user-title">Cadastrar usuário</h2>
      <Form
        className="hr-user-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name: name.trim(), email: email.trim(), role });
        }}
      >
        <TextField className="hr-field" isRequired value={name} onChange={setName}>
          <Label>Nome completo</Label>
          <Input className="hr-input" autoComplete="name" />
          <FieldError />
        </TextField>
        <TextField className="hr-field" isRequired type="email" value={email} onChange={setEmail}>
          <Label>E-mail</Label>
          <Input className="hr-input" autoComplete="email" />
          <FieldError />
        </TextField>
        <FilterSelect
          label="Novo papel"
          value={role}
          options={ROLE_OPTIONS.filter((option) => option.id !== "all")}
          onChange={(value) => {
            const parsed = Role.safeParse(value);
            if (parsed.success) setRole(parsed.data);
          }}
        />
        {role === "THERAPIST" && <p className="hr-help">O perfil de massoterapeuta será criado automaticamente.</p>}
        <div className="hr-form-actions">
          <Button type="submit" className="cta" isDisabled={isDisabled}>
            Salvar usuário
          </Button>
          <Button type="button" className="ghost-btn" onPress={onCancel} isDisabled={isDisabled}>
            Cancelar cadastro
          </Button>
        </div>
      </Form>
    </section>
  );
}

interface UserActionsProps {
  user: User;
  onToggleStatus: (user: User) => void;
}

function UserActions({ user, onToggleStatus }: UserActionsProps) {
  return (
    <Button className="ghost-btn hr-user-action" onPress={() => onToggleStatus(user)}>
      {user.status === "ACTIVE" ? `Desativar usuário ${user.name}` : `Ativar usuário ${user.name}`}
    </Button>
  );
}

interface UsersResultsProps {
  users: User[];
  onToggleStatus: (user: User) => void;
}

function UsersResults({ users, onToggleStatus }: UsersResultsProps) {
  if (users.length === 0) return <p className="hr-empty">Nenhum usuário encontrado.</p>;

  return (
    <>
      <div className="hr-users-table-wrap">
        <table className="hr-users-table">
          <caption>Usuários cadastrados</caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Papel</th>
              <th scope="col">Status</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <th scope="row">{user.name}</th>
                <td>{user.email}</td>
                <td>{ROLE_LABEL[user.role]}</td>
                <td>{STATUS_LABEL[user.status]}</td>
                <td>
                  <UserActions user={user} onToggleStatus={onToggleStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="hr-users-mobile" aria-label="Usuários cadastrados">
        {users.map((user) => (
          <li key={user.id} className="hr-user-card">
            <h2>{user.name}</h2>
            <dl>
              <div>
                <dt>E-mail</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Papel</dt>
                <dd>{ROLE_LABEL[user.role]}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[user.status]}</dd>
              </div>
            </dl>
            <UserActions user={user} onToggleStatus={onToggleStatus} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function UsersPage() {
  const announce = useContext(AnnouncerContext);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({ role: "", status: "", search: "" });
  const [submittedFilters, setSubmittedFilters] = useState<UserFilters>({ role: "", status: "", search: "" });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const announcementAfterReload = useRef<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    getUsers(submittedFilters).then(
      (result) => {
        if (!isCurrent) return;
        setUsers(result);
        setLoadState("ready");
        const actionAnnouncement = announcementAfterReload.current;
        if (actionAnnouncement) {
          announcementAfterReload.current = null;
          announce(actionAnnouncement);
        } else {
          announce(result.length ? `${result.length} usuários encontrados.` : "Nenhum usuário encontrado.");
        }
      },
      (error: unknown) => {
        if (!isCurrent) return;
        const actionAnnouncement = announcementAfterReload.current;
        if (actionAnnouncement) {
          announcementAfterReload.current = null;
          announce(actionAnnouncement);
        }
        setLoadError(errorMessage(error));
        setLoadState("error");
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [announce, reload, submittedFilters]);

  useEffect(() => {
    if (loadState === "error") errorRef.current?.focus();
  }, [loadState]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionMessage(null);
    setLoadError(null);
    setLoadState("loading");
    setSubmittedFilters({ ...filters, search: filters.search.trim() });
  };

  const handleRetry = () => {
    setLoadError(null);
    setLoadState("loading");
    setReload((value) => value + 1);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (pendingAction.kind === "create") {
        const user = await createUser(pendingAction.input);
        const message = `${user.name} cadastrado como ${ROLE_LABEL[user.role]}, e-mail ${user.email}. Status: ${STATUS_LABEL[user.status]}.`;
        setActionMessage(message);
        setShowCreateForm(false);
        setPendingAction(null);
        setLoadError(null);
        setLoadState("loading");
        announcementAfterReload.current = message;
        setReload((value) => value + 1);
      } else {
        const user = await updateUserStatus(pendingAction.user.id, pendingAction.status);
        const message = `${user.name} ${user.status === "ACTIVE" ? "ativado" : "desativado"}.`;
        setUsers((current) => current.map((entry) => (entry.id === user.id ? user : entry)));
        setPendingAction(null);
        setActionMessage(message);
        announce(message);
      }
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  };

  const nextStatus = (user: User) => (user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
  const confirmationTitle =
    pendingAction?.kind === "create"
      ? "Cadastrar este usuário?"
      : pendingAction?.status === "ACTIVE"
        ? "Ativar este usuário?"
        : "Desativar este usuário?";
  const confirmLabel =
    pendingAction?.kind === "create"
      ? "Confirmar cadastro"
      : pendingAction?.status === "ACTIVE"
        ? "Ativar usuário"
        : "Desativar usuário";

  return (
    <main id="conteudo" className="page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Usuários
          </h1>
          <p className="lede">Pesquise, cadastre e atualize o acesso das pessoas ao sistema.</p>
        </header>

        <section className="hr-panel" aria-labelledby="user-search-title">
          <h2 id="user-search-title">Buscar usuários</h2>
          <UsersFilters filters={filters} onFiltersChange={setFilters} onSearch={handleSearch} />
        </section>

        <section className="hr-panel" aria-labelledby="user-list-title">
          <div className="hr-section-heading">
            <h2 id="user-list-title">Usuários cadastrados</h2>
            <Button className="cta" onPress={() => setShowCreateForm((value) => !value)}>
              {showCreateForm ? "Fechar cadastro" : "Cadastrar usuário"}
            </Button>
          </div>
          {actionMessage && <p className="hr-success">{actionMessage}</p>}
          {showCreateForm && (
            <UserForm
              onSubmit={(input) => {
                setActionError(null);
                setPendingAction({ kind: "create", input });
              }}
              onCancel={() => setShowCreateForm(false)}
              isDisabled={actionBusy}
            />
          )}
          {loadState === "loading" && (
            <p className="hr-state" role="status">
              Carregando usuários…
            </p>
          )}
          {loadState === "error" && loadError && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={errorRef}>
              <p>{loadError}</p>
              <Button className="cta" onPress={handleRetry}>
                Tentar novamente
              </Button>
            </div>
          )}
          {loadState === "ready" && (
            <UsersResults
              users={users}
              onToggleStatus={(user) => {
                setActionError(null);
                setPendingAction({ kind: "status", user, status: nextStatus(user) });
              }}
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        isOpen={pendingAction !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !actionBusy) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
        title={confirmationTitle}
        confirmLabel={confirmLabel}
        busyLabel={pendingAction?.kind === "create" ? "Cadastrando…" : "Atualizando…"}
        onConfirm={handleConfirm}
        busy={actionBusy}
        error={actionError}
        confirmClassName="cta"
      >
        {pendingAction?.kind === "create" ? (
          <p>
            Confirme o cadastro de {pendingAction.input.name} como {ROLE_LABEL[pendingAction.input.role]}. O usuário
            começará ativo.{" "}
            {pendingAction.input.role === "THERAPIST" && "O perfil de massoterapeuta será criado automaticamente."}
          </p>
        ) : (
          <p>
            O acesso de {pendingAction?.kind === "status" ? pendingAction.user.name : ""} será{" "}
            {pendingAction?.status === "ACTIVE" ? "ativado" : "desativado"}.
          </p>
        )}
      </ConfirmDialog>
    </main>
  );
}
