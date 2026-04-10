import { useDispatch } from 'react-redux';
import { initCustomAlertDialog } from '@/features/navigation/slice';
import { userSliceActions } from '@/features/users/slice';
import { RootState } from '@/store';
import { useAppSelector } from '@/lib/hooks';
import { useNavigate } from '@/hooks/user-navigate';
export function useCustomAlertDialog() {
  const dispatch = useDispatch();
  const { navigateToHome } = useNavigate();
  const isInstructorMode = useAppSelector(
    (state: RootState) => state.user.isInstructorMode,
  );

  const openCustomAlertDialog = (
    message: string,
    validateTrigger: string,
    title: string,
    cancelTrigger?: string,
  ) => {
    dispatch(
      initCustomAlertDialog({
        message,
        validateTrigger,
        cancelTrigger,
        title,
        isOpen: true,
      }),
    );
  };

  const closeCustomAlertDialog = () => {
    dispatch(
      initCustomAlertDialog({
        message: '',
        validateTrigger: '',
        cancelTrigger: '',
        title: '',
        isOpen: false,
      }),
    );
  };

  const triggerHandler = (trigger: string) => {
    switch (trigger) {
      case 'SWITCH_TO_LEARNER':
        dispatch(userSliceActions.setIsInstructorMode(!isInstructorMode));
        closeCustomAlertDialog();
        navigateToHome();
        break;
      default:
        closeCustomAlertDialog();
        break;
    }
  };

  return {
    openCustomAlertDialog,
    closeCustomAlertDialog,
    triggerHandler,
  };
}
