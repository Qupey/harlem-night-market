import { z } from "zod";

export const CATEGORIES = [
  "Jewelry",
  "Soaps",
  "Candles",
  "Clothing",
  "Art",
  "Accessories",
  "Home goods",
  "Books",
  "Beauty / skincare",
  "Packaged food",
  "Hot food",
  "Beverages",
  "Dessert",
  "Other",
] as const;

export const FOOD_CATEGORIES: readonly string[] = ["Packaged food", "Hot food", "Beverages", "Dessert"];

export const FOOD_TYPES = [
  "Packaged food",
  "Hot food",
  "Prepared on-site",
  "Prepared off-site",
  "Beverages",
  "Desserts",
  "Other",
] as const;

export const DIETARY_TAGS = ["Vegan", "Vegetarian", "Gluten-free", "Contains nuts", "Halal", "Kosher", "Dairy-free"] as const;

export const LICENSE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "in_progress", label: "In progress" },
] as const;

export const SPACE_OPTIONS = ["Standard 10x10", "Half table", "Food tent", "Truck/cart", "Other"] as const;

export const AGREEMENTS = [
  { key: "noGuarantee", label: "I understand submission does not guarantee acceptance." },
  { key: "followRules", label: "I agree to follow event rules and setup times." },
  { key: "accurateInfo", label: "I confirm that the information provided is accurate." },
  { key: "foodPermits", label: "If selling food, I understand I may need proper permits/licenses." },
  { key: "contactConsent", label: "I agree to be contacted by the event organizers." },
] as const;

export function isFoodVendor(categories: readonly string[] | undefined): boolean {
  return !!categories?.some((c) => FOOD_CATEGORIES.includes(c));
}

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
const yesNo = z.enum(["yes", "no"], { message: "Please choose yes or no" });
const mustAgree = z.literal(true, { message: "Please check this box to continue" });

export const menuItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  description: optionalText,
  price: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v?.replace(/^\$\s*/, "") ?? ""),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)),
});

export const applicationSchema = z
  .object({
    // Contact information
    contactName: z.string().trim().min(1, "Contact name is required").max(120),
    businessName: z.string().trim().min(1, "Business name is required").max(120),
    email: z.email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number")
      .max(25)
      .regex(/^[0-9+().\-\s]+$/, "Enter a valid phone number"),
    instagram: optionalText,
    website: optionalText,
    businessAddress: optionalText,

    // Goods / vendor type
    categories: z.array(z.enum(CATEGORIES)).min(1, "Choose at least one category"),
    otherCategory: optionalText,

    // Food vendor section (only validated when a food category is selected)
    foodTypes: z.array(z.enum(FOOD_TYPES)),
    otherFoodType: optionalText,
    menuItems: z.array(menuItemSchema).max(30),
    foodHandlerLicense: z.enum(["yes", "no", "in_progress"]).optional(),
    licenseNumber: optionalText,
    licenseExpiration: optionalText,

    // Event preferences
    firstChoice: z.string().optional(),
    secondChoice: z.string().optional(),
    thirdChoice: z.string().optional(),
    availableAllDates: z.boolean(),
    availabilityNotes: optionalText,

    // Setup details
    spaceNeeded: z.enum(SPACE_OPTIONS, { message: "Choose how much space you need" }),
    spaceOther: optionalText,
    needsElectricity: yesNo,
    needsTable: yesNo,
    needsChairs: yesNo,
    setupNotes: z.string().trim().max(2000).optional().or(z.literal("")),

    // Agreements
    agreements: z.object({
      noGuarantee: mustAgree,
      followRules: mustAgree,
      accurateInfo: mustAgree,
      foodPermits: z.boolean(),
      contactConsent: mustAgree,
    }),
  })
  .superRefine((data, ctx) => {
    if (data.categories.includes("Other") && !data.otherCategory) {
      ctx.addIssue({ code: "custom", path: ["otherCategory"], message: "Tell us what you sell" });
    }
    if (data.spaceNeeded === "Other" && !data.spaceOther) {
      ctx.addIssue({ code: "custom", path: ["spaceOther"], message: "Describe the space you need" });
    }
    if (!data.availableAllDates && !data.firstChoice) {
      ctx.addIssue({
        code: "custom",
        path: ["firstChoice"],
        message: "Pick your first-choice date, or check that you are available for all dates",
      });
    }
    const picks = [data.firstChoice, data.secondChoice, data.thirdChoice].filter(Boolean);
    if (new Set(picks).size !== picks.length) {
      ctx.addIssue({ code: "custom", path: ["secondChoice"], message: "Each choice should be a different date" });
    }
    if (isFoodVendor(data.categories)) {
      if (data.foodTypes.length === 0) {
        ctx.addIssue({ code: "custom", path: ["foodTypes"], message: "Choose at least one food type" });
      }
      if (data.foodTypes.includes("Other") && !data.otherFoodType) {
        ctx.addIssue({ code: "custom", path: ["otherFoodType"], message: "Describe your food type" });
      }
      if (data.menuItems.length === 0) {
        ctx.addIssue({ code: "custom", path: ["menuItems"], message: "Add at least one menu item" });
      }
      if (!data.foodHandlerLicense) {
        ctx.addIssue({ code: "custom", path: ["foodHandlerLicense"], message: "Let us know your license status" });
      }
      if (!data.agreements.foodPermits) {
        ctx.addIssue({
          code: "custom",
          path: ["agreements", "foodPermits"],
          message: "Please check this box to continue",
        });
      }
    }
  });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationData = z.output<typeof applicationSchema>;

// File uploads sent alongside the form. Field name -> document type.
export const UPLOAD_FIELDS = {
  foodLicenseFile: { label: "Proof of food handler license", multiple: false, foodOnly: true },
  dohPermitFile: { label: "DOH permit", multiple: false, foodOnly: true },
  insuranceFile: { label: "Insurance certificate", multiple: false, foodOnly: true },
  logo: { label: "Logo", multiple: false, foodOnly: false },
  productImages: { label: "Product images", multiple: true, foodOnly: false },
} as const;

export type UploadField = keyof typeof UPLOAD_FIELDS;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_FIELD = 6;
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif", "application/pdf"];
