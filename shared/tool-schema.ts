import { z } from "zod";

export const FieldTypeSchema = z.enum([
  "text",
  "number",
  "currency",
  "percent",
  "select",
  "date",
  "boolean",
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

export const ToolFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export type ToolField = z.infer<typeof ToolFieldSchema>;

export const ToolComputedSchema = z.object({
  id: z.string(),
  label: z.string(),
  expression: z.string(),
  type: FieldTypeSchema.optional(),
});

export type ToolComputed = z.infer<typeof ToolComputedSchema>;

export const ToolSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  fields: z.array(ToolFieldSchema),
  computed: z.array(ToolComputedSchema),
});

export type ToolSchema = z.infer<typeof ToolSchemaSchema>;

export const SAMPLE_TOOL_SCHEMA: ToolSchema = {
  id: "inventory-reorder-pricing",
  name: "Inventory Reorder & Pricing",
  description:
    "Track stock levels, reorder thresholds, costs and computed sell prices for each inventory item.",
  fields: [
    { id: "item", label: "Item", type: "text", required: true },
    { id: "stockQty", label: "Stock Qty", type: "number", required: true },
    {
      id: "reorderThreshold",
      label: "Reorder Threshold",
      type: "number",
      required: true,
    },
    { id: "unitCost", label: "Unit Cost", type: "currency", required: true },
    { id: "margin", label: "Margin %", type: "percent", required: true },
    {
      id: "supplier",
      label: "Supplier",
      type: "select",
      options: ["Acme", "Global", "Local"],
    },
  ],
  computed: [
    {
      id: "needsReorder",
      label: "Needs Reorder?",
      expression: "stockQty <= reorderThreshold",
      type: "boolean" as const,
    },
    {
      id: "sellPrice",
      label: "Sell Price",
      expression: "unitCost * (1 + margin/100)",
      type: "currency" as const,
    },
  ],
};

export const SAMPLE_ROWS: Record<string, unknown>[] = [
  {
    item: "Widget A",
    stockQty: 12,
    reorderThreshold: 20,
    unitCost: 4.5,
    margin: 40,
    supplier: "Acme",
  },
  {
    item: "Gadget B",
    stockQty: 55,
    reorderThreshold: 30,
    unitCost: 12.0,
    margin: 35,
    supplier: "Global",
  },
  {
    item: "Part C",
    stockQty: 8,
    reorderThreshold: 15,
    unitCost: 2.25,
    margin: 50,
    supplier: "Local",
  },
];
