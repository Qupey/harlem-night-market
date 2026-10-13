"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { DIETARY_TAGS, type ApplicationData, type ApplicationInput } from "@/lib/schema";
import { Choice, ErrorText, Field } from "./form-ui";

type Form = UseFormReturn<ApplicationInput, unknown, ApplicationData>;

export function MenuItemRepeater({ form }: { form: Form }) {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "menuItems" });

  return (
    <div>
      <span className="field-label">
        Menu items<span className="text-orange"> *</span>
      </span>
      <div className="space-y-4">
        {fields.map((item, i) => (
          <div key={item.id} className="rounded-xl border border-line bg-navy-deep/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Item {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-sm text-muted underline hover:text-danger">
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Item name" required error={errors.menuItems?.[i]?.name}>
                <input className="field-input" {...register(`menuItems.${i}.name`)} />
              </Field>
              <Field label="Price" error={errors.menuItems?.[i]?.price}>
                <input className="field-input" inputMode="decimal" placeholder="$" {...register(`menuItems.${i}.price`)} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Description" error={errors.menuItems?.[i]?.description}>
                <input className="field-input" {...register(`menuItems.${i}.description`)} />
              </Field>
            </div>
            <fieldset className="mt-3">
              <legend className="field-label">Dietary tags</legend>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((t) => (
                  <Choice key={t} type="checkbox" value={t} label={t} className="py-1.5" {...register(`menuItems.${i}.dietaryTags`)} />
                ))}
              </div>
            </fieldset>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn-secondary mt-3"
        onClick={() => append({ name: "", description: "", price: "", dietaryTags: [] })}
      >
        + Add menu item
      </button>
      <ErrorText error={errors.menuItems} />
    </div>
  );
}
