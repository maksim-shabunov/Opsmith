import { Hono } from "hono";
import * as XLSX from "xlsx";

const upload = new Hono();

// Allowed MIME types and extensions for spreadsheets
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".ods"]);

upload.post("/", async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid multipart form data" }, 400);
  }

  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file uploaded" }, 400);
  if (file.size === 0) return c.json({ error: "Uploaded file is empty" }, 400);

  // Extension check
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json(
      {
        error: `Unsupported file type "${ext}". Please upload an .xlsx, .xls, or .csv file.`,
      },
      400
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return c.json({ error: "Failed to read uploaded file" }, 400);
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    return c.json(
      { error: "Could not parse the file. Make sure it is a valid spreadsheet." },
      400
    );
  }

  if (!workbook.SheetNames.length) {
    return c.json({ error: "The spreadsheet has no sheets." }, 400);
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  if (grid.length === 0) {
    return c.json({ error: "The first sheet appears to be empty." }, 400);
  }

  return c.json({ grid, sheetName: firstSheetName });
});

export default upload;
