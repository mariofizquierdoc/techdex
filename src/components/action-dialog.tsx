"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError, SubmitButton, useFormAction } from "@/components/form";
import type { ActionState } from "@/lib/action";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A dialog containing a server-action form. Closes and toasts on success.
 * The form unmounts when the dialog closes, so each opening starts fresh.
 */
export function ActionDialog({
  title,
  description,
  trigger,
  action,
  submitLabel = "Save",
  children,
}: {
  title: string;
  description?: string;
  trigger: React.ReactNode;
  action: FormAction;
  submitLabel?: string;
  children: (state: ActionState) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogForm action={action} submitLabel={submitLabel} onDone={() => setOpen(false)}>
          {children}
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  onDone: () => void;
  children: (state: ActionState) => React.ReactNode;
}) {
  const { state, onSubmit, pending } = useFormAction(action, {} as ActionState);
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  });

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      onDoneRef.current();
    }
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {children(state)}
      <FormError message={state.error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
