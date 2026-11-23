import { Navigate, Outlet, useLocation, useParams, type RouteObject } from "react-router";
import { SkipLinks } from "@/shared/a11y/SkipLinks";
import { Navbar } from "@/shared/ui/Navbar";
import { useCurrentSession, useProfile } from "@/features/auth/hooks/use-current-session";
import { useRouteState, type RouteState } from "@/features/auth/hooks/use-route-state";
import { useSwitchUser } from "@/features/auth/hooks/use-switch-user";
import { ROLE_HOME, SIGN_IN_PATH } from "@/features/auth/auth-paths";
import SignIn from "@/features/auth/components/SignIn";
import RequireSignIn from "@/features/auth/components/RequireSignIn";
import RequireRole from "@/features/auth/components/RequireRole";
import CheckIn from "@/features/check-in/components/CheckIn";
import { parseCheckInToken } from "@/features/check-in/check-in-token";
import AccessibilityPage from "@/features/accessibility/components/AccessibilityPage";
import ProfilePage from "@/features/auth/components/ProfilePage";
import BookingPage from "./BookingPage";
import SessionsPage from "./SessionsPage";
import { RouteFocus, type RouteHandle } from "./RouteFocus";
import UsersPage from "@/features/hr/users/UsersPage";
import RoomsPage from "@/features/hr/rooms/RoomsPage";
import SchedulesPage from "@/features/hr/schedules/SchedulesPage";
import BlocksPage from "@/features/hr/blocks/BlocksPage";
import BusinessRulesPage from "@/features/hr/business-rules/BusinessRulesPage";
import AlexaPairingPage from "@/features/hr/alexa-pairing/AlexaPairingPage";
import ReportsPage from "@/features/hr/reports/ReportsPage";
import AuditPage from "@/features/hr/audit/AuditPage";
import TherapistPage from "@/features/therapist/TherapistPage";
import SupportPage from "./SupportPage";
import ChatPage from "@/features/chat/ChatPage";

function Layout() {
  const session = useCurrentSession();
  const { pathname } = useLocation();
  const switchUser = useSwitchUser();
  const isBookingPage = pathname === "/" || pathname === "/book";
  const isEmployeeWorkspace =
    session.profile?.role === "EMPLOYEE" && (isBookingPage || pathname === "/sessions" || pathname === "/profile");
  const isSessionsPage = pathname === "/sessions";
  return (
    <>
      <SkipLinks />
      <Navbar
        profile={session.profile}
        onSwitch={switchUser}
        links={
          isEmployeeWorkspace
            ? [
                [isBookingPage ? "#agenda" : "/", "Reservar"],
                [isSessionsPage ? "#sessoes" : "/sessions", "Suas sessões"],
                ["/profile", "Meu perfil"],
              ]
            : session.profile
              ? [["/profile", "Meu perfil"]]
              : []
        }
        cta={null}
      />
      {session.status === "loading" ? (
        <main id="conteudo" className="page">
          <p className="page-in" role="status">
            Carregando…
          </p>
        </main>
      ) : (
        <>
          <RouteFocus />
          <Outlet />
        </>
      )}
    </>
  );
}

function SignInRoute() {
  const session = useCurrentSession();
  const { from } = useRouteState();
  if (session.profile) return <Navigate to={from ?? ROLE_HOME[session.profile.role]} replace />;
  return (
    <SignIn
      users={session.users}
      error={session.usersError}
      onRetry={session.retryUsers}
      onPick={session.signIn}
      notice={session.notice}
    />
  );
}

function HomeRoute() {
  const profile = useProfile();
  const { notice } = useRouteState();
  if (profile.role !== "EMPLOYEE")
    return <Navigate to={ROLE_HOME[profile.role]} replace state={{ notice } satisfies RouteState} />;
  return <BookingPage isHome notice={notice} />;
}

function EmployeeHomeRoute() {
  return <SessionsPage profile={useProfile()} />;
}

function CheckInRoute() {
  const { token = "" } = useParams();
  return <CheckIn profile={useProfile()} token={parseCheckInToken(token)} />;
}

function TherapistRoute() {
  const { notice } = useRouteState();
  return <TherapistPage notice={notice} />;
}

function ReportsRoute() {
  const profile = useProfile();
  return <ReportsPage isSupportUser={profile.role === "ADMIN"} />;
}

const titled = (title: string): RouteHandle => ({ title });

const hrRoutes: RouteObject = {
  element: <RequireRole requiredRole="HR" />,
  children: [
    { path: "/hr", element: <Navigate to="/hr/users" replace />, handle: titled("RH") },
    { path: "/hr/users", element: <UsersPage />, handle: titled("Usuários") },
    { path: "/hr/locations", element: <RoomsPage />, handle: titled("Unidades e salas") },
    { path: "/hr/schedules", element: <SchedulesPage />, handle: titled("Agendas") },
    { path: "/hr/blocks", element: <BlocksPage />, handle: titled("Horários sem atendimento") },
    { path: "/hr/rules", element: <BusinessRulesPage />, handle: titled("Horários e limites de agendamento") },
    { path: "/hr/alexa-pairing", element: <AlexaPairingPage />, handle: titled("Conectar a Alexa") },
    { path: "/hr/reports", element: <ReportsRoute />, handle: titled("Relatórios de atendimento") },
    { path: "/hr/audit", element: <AuditPage />, handle: titled("Histórico de alterações") },
  ],
};

const adminRoutes: RouteObject = {
  element: <RequireRole requiredRole="ADMIN" />,
  children: [{ path: ROLE_HOME.ADMIN, element: <SupportPage />, handle: titled("Suporte") }],
};

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: SIGN_IN_PATH, element: <SignInRoute />, handle: titled("Entrar") },
      { path: "/accessibility", element: <AccessibilityPage />, handle: titled("Acessibilidade") },
      { path: "/chat", element: <ChatPage />, handle: titled("Assistente de dúvidas") },
      {
        element: <RequireSignIn />,
        children: [
          { index: true, element: <HomeRoute />, handle: titled("Início") },
          { path: "/profile", element: <ProfilePage />, handle: titled("Meu perfil") },
          {
            element: <RequireRole requiredRole="EMPLOYEE" />,
            children: [
              { path: "/book", element: <BookingPage />, handle: titled("Reservar") },
              { path: "/sessions", element: <EmployeeHomeRoute />, handle: titled("Suas sessões") },
              { path: "/check-in/:token", element: <CheckInRoute />, handle: titled("Check-in") },
            ],
          },
          hrRoutes,
          {
            element: <RequireRole requiredRole="THERAPIST" />,
            children: [{ path: "/therapist", element: <TherapistRoute />, handle: titled("Agenda do massoterapeuta") }],
          },
          adminRoutes,
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];
