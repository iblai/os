"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCustomAlertDialog } from "@/hooks/use-custom-alert-dialog";

interface CustomAlertDialogProps {
  message: string;
  validateTrigger: string;
  cancelTrigger?: string;
  title?: string;
  isOpen: boolean;
}

export function CustomAlertDialog({
  message,
  validateTrigger,
  cancelTrigger = "",
  title = "Are you sure?",
  isOpen,
}: CustomAlertDialogProps) {
  const { triggerHandler } = useCustomAlertDialog();
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => triggerHandler(cancelTrigger)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => triggerHandler(validateTrigger)}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
