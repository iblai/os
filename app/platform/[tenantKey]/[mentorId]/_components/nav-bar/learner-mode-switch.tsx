import { Switch } from "@/components/ui/switch";
import { useLearnerMode } from "@/hooks/use-user";

export function LearnerModeSwitch() {
  const { isInstructorMode, toggleLearnerMode } = useLearnerMode();

  return (
    <Switch
      checked={isInstructorMode}
      onCheckedChange={toggleLearnerMode}
      className="data-[state=checked]:bg-blue-500"
      aria-label={`Learner mode ${isInstructorMode ? "enabled" : "disabled"}`}
    />
  );
}
