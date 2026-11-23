import { useState } from "react";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { MotionConfig } from "motion/react";
import { I18nProvider } from "react-aria-components";
import { Announcer } from "@/shared/a11y/Announcer";
import { useSession } from "@/features/auth/hooks/use-session";
import { SessionContext } from "@/features/auth/hooks/use-current-session";
import { routes } from "./routes";

export default function App() {
  const session = useSession();
  const [router] = useState(() => createBrowserRouter(routes));

  return (
    <I18nProvider locale="pt-BR">
      <MotionConfig reducedMotion="user">
        <Announcer>
          <SessionContext value={session}>
            <RouterProvider router={router} />
          </SessionContext>
        </Announcer>
      </MotionConfig>
    </I18nProvider>
  );
}
