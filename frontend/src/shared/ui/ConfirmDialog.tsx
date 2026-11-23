import { useEffect, useRef, type ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay, type ButtonProps } from "react-aria-components";
import { useFocusOnMount } from "@/shared/a11y/use-focus-on-mount";

function SafeButton(props: ButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>();
  return <Button ref={ref} className="ghost-btn" {...props} />;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  onConfirm: () => void;
  error: string | null;
  busy: boolean;
  confirmClassName?: string;
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  busyLabel,
  onConfirm,
  error,
  busy,
  confirmClassName = "danger-btn",
}: ConfirmDialogProps) {
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <ModalOverlay
      className="overlay"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <Modal className="modal">
        <Dialog className="dialog" role="alertdialog">
          {({ close }) => (
            <>
              <Heading slot="title" className="dialog-title">
                {title}
              </Heading>
              <div className="dialog-body">{children}</div>
              {error && (
                <p className="field-error" role="alert" tabIndex={-1} ref={errorRef}>
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <SafeButton onPress={close} isDisabled={busy}>
                  Voltar
                </SafeButton>
                <Button className={confirmClassName} onPress={busy ? undefined : onConfirm} aria-disabled={busy || undefined}>
                  {busy ? busyLabel : confirmLabel}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
