"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton, useFormAction } from "@/components/form";
import type { ActionState } from "@/lib/action";

export type ItemFormValues = {
  assetTag: string;
  serialNumber: string;
  categoryId: string;
  brand: string;
  model: string;
  description: string;
  notes: string;
  purchasePrice: string;
  purchasedAt: string;
};

export function ItemForm({
  action,
  categories,
  defaults,
  cancelHref,
  isEdit = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string }[];
  defaults?: Partial<ItemFormValues>;
  cancelHref: string;
  isEdit?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(action, {} as ActionState);
  const err = state.fieldErrors ?? {};

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset tag *" htmlFor="assetTag" error={err.assetTag} hint="Your internal ID, e.g. LT-0042">
            <Input id="assetTag" name="assetTag" defaultValue={defaults?.assetTag} required />
          </Field>
          <Field label="Serial number" htmlFor="serialNumber" error={err.serialNumber}>
            <Input id="serialNumber" name="serialNumber" defaultValue={defaults?.serialNumber} />
          </Field>
          <Field label="Category *" htmlFor="categoryId" error={err.categoryId}>
            <Select name="categoryId" defaultValue={defaults?.categoryId}>
              <SelectTrigger id="categoryId" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand" htmlFor="brand" error={err.brand}>
              <Input id="brand" name="brand" defaultValue={defaults?.brand} placeholder="Dell" />
            </Field>
            <Field label="Model" htmlFor="model" error={err.model}>
              <Input id="model" name="model" defaultValue={defaults?.model} placeholder="Latitude 5440" />
            </Field>
          </div>
          <Field label="Description *" htmlFor="description" error={err.description} className="sm:col-span-2">
            <Input
              id="description"
              name="description"
              defaultValue={defaults?.description}
              placeholder='14" laptop, 16 GB RAM, 512 GB SSD'
              required
            />
          </Field>
          <Field label="Purchase price" htmlFor="purchasePrice" error={err.purchasePrice}>
            <Input id="purchasePrice" name="purchasePrice" inputMode="decimal" defaultValue={defaults?.purchasePrice} placeholder="1299.00" />
          </Field>
          <Field label="Purchase date" htmlFor="purchasedAt" error={err.purchasedAt}>
            <Input id="purchasedAt" name="purchasedAt" type="date" defaultValue={defaults?.purchasedAt} />
          </Field>
          {!isEdit && (
            <Field
              label="Condition notes"
              htmlFor="notes"
              error={err.notes}
              className="sm:col-span-2"
              hint='e.g. "new in box", "good 7/10", "screen scratched"'
            >
              <Textarea id="notes" name="notes" defaultValue={defaults?.notes} rows={3} />
            </Field>
          )}
          {isEdit && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Condition, status and assignee are changed from the item page so every change is recorded in its history.
            </p>
          )}
          <div className="sm:col-span-2">
            <FormError message={state.error} />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <SubmitButton pending={pending}>{isEdit ? "Save changes" : "Create item"}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
