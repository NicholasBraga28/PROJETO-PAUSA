import { ToggleButton } from "react-aria-components";
import { Pause, Play } from "lucide-react";

interface PauseAnimationButtonProps {
  isPaused: boolean;
  onChange: (isPaused: boolean) => void;
}

export function PauseAnimationButton({ isPaused, onChange }: PauseAnimationButtonProps) {
  const Icon = isPaused ? Play : Pause;
  return (
    <ToggleButton className="scene-pause" isSelected={isPaused} onChange={onChange}>
      <Icon className="w-4 h-4" aria-hidden="true" />
      Pausar animação
    </ToggleButton>
  );
}
