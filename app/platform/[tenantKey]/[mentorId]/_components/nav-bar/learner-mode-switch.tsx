import { useTranslations } from 'next-intl';

import { Switch } from '@/components/ui/switch';
import { useLearnerMode } from '@/hooks/use-user';

export function LearnerModeSwitch() {
  const { isInstructorMode, toggleLearnerMode } = useLearnerMode();
  const t = useTranslations('learnerModeSwitch');

  return (
    <Switch
      checked={isInstructorMode}
      onCheckedChange={toggleLearnerMode}
      className="data-[state=checked]:bg-blue-500"
      aria-label={
        isInstructorMode ? t('userModeEnabled') : t('userModeDisabled')
      }
    />
  );
}
