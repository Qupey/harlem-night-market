"use client";

import type { Dispatch, SetStateAction } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { FOOD_TYPES, LICENSE_OPTIONS, type ApplicationData, type ApplicationInput, type UploadField } from "@/lib/schema";
import { FileUploadField } from "./FileUploadField";
import { Choice, Field } from "./form-ui";
import { MenuItemRepeater } from "./MenuItemRepeater";

type Form = UseFormReturn<ApplicationInput, unknown, ApplicationData>;
type Files = Partial<Record<UploadField, File[]>>;

export function FoodVendorFields({
  form,
  files,
  setFiles,
}: {
  form: Form;
  files: Files;
  setFiles: Dispatch<SetStateAction<Files>>;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const foodTypes = useWatch({ control, name: "foodTypes" });

  return (
    <div className="space-y-6">
      <Field label="Food type" required group error={errors.foodTypes}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FOOD_TYPES.map((t) => (
            <Choice key={t} type="checkbox" value={t} label={t} {...register("foodTypes")} />
          ))}
        </div>
      </Field>
      {foodTypes?.includes("Other") && (
        <Field label="Describe your food type" required error={errors.otherFoodType}>
          <input className="field-input" {...register("otherFoodType")} />
        </Field>
      )}

      <MenuItemRepeater form={form} />

      <Field label="Do you have a food handler's license?" required group error={errors.foodHandlerLicense}>
        <div className="flex gap-2">
          {LICENSE_OPTIONS.map((o) => (
            <Choice key={o.value} type="radio" value={o.value} label={o.label} className="flex-1" {...register("foodHandlerLicense")} />
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="License number" error={errors.licenseNumber}>
          <input className="field-input" {...register("licenseNumber")} />
        </Field>
        <Field label="License expiration date" error={errors.licenseExpiration}>
          <input className="field-input" type="date" {...register("licenseExpiration")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FileUploadField field="foodLicenseFile" files={files} setFiles={setFiles} />
        <FileUploadField field="dohPermitFile" files={files} setFiles={setFiles} />
        <FileUploadField field="insuranceFile" files={files} setFiles={setFiles} />
      </div>
    </div>
  );
}
