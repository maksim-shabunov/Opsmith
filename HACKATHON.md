# Opsmith

**Turn messy spreadsheets into working internal tools with AI.**

---

## The Issue

Every small physical business — a workshop, an HVAC contractor, a bakery, a
one-location clinic — is quietly run on a spreadsheet. Reorder thresholds, margin
math, payroll formulas, scheduling logic: the real operating logic of the business
already exists, buried in a cell nobody but one employee understands. These
businesses can't afford custom software, and off-the-shelf SaaS never quite matches
how they actually work — so the spreadsheet stays the source of truth, one accidental
deletion or one departure away from breaking. The knowledge is there. It's just
trapped in a format nobody can safely build on.

## Our Magic Solution

Opsmith reads the spreadsheet a business already has and turns it directly into a
working internal tool — no spec, no developer, no formula editing. Upload a file and
an LLM infers the schema: field types, and computed columns like "needs reorder" or
"sell price" expressed as safe formulas. Describe a change in plain English —
*"add a 10% rush surcharge"* — and the tool rewrites itself live, the new column
landing and recalculating instantly.

The magic isn't just that AI reads the spreadsheet — it's what the AI is and isn't
allowed to do. The model never writes code. It only ever produces a small, strictly
validated schema, which is evaluated by a sandboxed expression engine and checked
against a strict data contract before it ever touches the database. That's what
turns "AI edits your business logic" from a liability into something you can
actually hand to a non-technical owner and trust with real numbers.
