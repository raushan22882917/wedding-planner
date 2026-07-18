export type ImportedGuest = {
  name: string;
  side: "bride" | "groom" | "both";
  relationship: string | null;
  phone: string | null;
  email: string | null;
  rsvp_status: "pending" | "yes" | "no" | "maybe";
  plus_one: boolean;
  dietary: string | null;
  address: string | null;
  notes: string | null;
};

export type GuestImportIssue = { row: number; message: string };
export type GuestImportPreview = {
  totalRows: number;
  guests: ImportedGuest[];
  issues: GuestImportIssue[];
};

const headerAliases: Record<string, keyof ImportedGuest> = {
  name: "name",
  full_name: "name",
  guest_name: "name",
  side: "side",
  family_side: "side",
  relationship: "relationship",
  relation: "relationship",
  phone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  whatsapp_number: "phone",
  email: "email",
  rsvp: "rsvp_status",
  rsvp_status: "rsvp_status",
  status: "rsvp_status",
  plus_one: "plus_one",
  plusone: "plus_one",
  plus_1: "plus_one",
  dietary: "dietary",
  dietary_requirements: "dietary",
  address: "address",
  notes: "notes",
};

export const guestImportTemplate = `name,side,relationship,phone,email,rsvp_status,plus_one,dietary,address,notes
Ananya Sharma,bride,Cousin,+91 98765 43210,ananya@example.com,pending,no,Vegetarian,Jaipur,Invite for sangeet
Rahul Verma,groom,College friend,+91 98765 43211,,yes,yes,,Delhi,`;

function cell(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizedHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function parseSide(value: string): ImportedGuest["side"] | null {
  const lower = value.toLowerCase();
  if (!lower || lower === "both" || lower === "all") return "both";
  if (["bride", "brides", "bride_side"].includes(lower)) return "bride";
  if (["groom", "grooms", "groom_side"].includes(lower)) return "groom";
  return null;
}

function parseRsvp(value: string): ImportedGuest["rsvp_status"] | null {
  const lower = value.toLowerCase();
  if (!lower || ["pending", "awaiting"].includes(lower)) return "pending";
  if (["yes", "confirmed", "confirm", "attending", "going"].includes(lower)) return "yes";
  if (["no", "declined", "not attending"].includes(lower)) return "no";
  if (["maybe", "unsure"].includes(lower)) return "maybe";
  return null;
}

function parseBoolean(value: string): boolean | null {
  const lower = value.toLowerCase();
  if (!lower || ["no", "false", "0", "n"].includes(lower)) return false;
  if (["yes", "true", "1", "y"].includes(lower)) return true;
  return null;
}

export function parseGuestImport(text: string): GuestImportPreview {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const firstLine = withoutBom.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = parseDelimited(withoutBom, delimiter);
  if (rows.length < 2)
    return {
      totalRows: 0,
      guests: [],
      issues: [{ row: 1, message: "Add a header row and at least one guest." }],
    };

  const headers = rows[0].map((value) => headerAliases[normalizedHeader(value)]);
  if (!headers.includes("name")) {
    return {
      totalRows: rows.length - 1,
      guests: [],
      issues: [{ row: 1, message: "A Name column is required." }],
    };
  }

  const guests: ImportedGuest[] = [];
  const issues: GuestImportIssue[] = [];

  rows.slice(1, 501).forEach((values, index) => {
    const raw = Object.fromEntries(
      headers.flatMap((header, column) => (header ? [[header, cell(values[column])]] : [])),
    ) as Partial<Record<keyof ImportedGuest, string>>;
    const name = cell(raw.name);
    const side = parseSide(cell(raw.side));
    const rsvp = parseRsvp(cell(raw.rsvp_status));
    const plusOne = parseBoolean(cell(raw.plus_one));
    const email = cell(raw.email).toLowerCase();
    const rowNumber = index + 2;

    if (!name) {
      issues.push({ row: rowNumber, message: "Name is required." });
      return;
    }
    if (name.length > 160) {
      issues.push({ row: rowNumber, message: "Name is too long." });
      return;
    }
    if (!side) {
      issues.push({ row: rowNumber, message: "Side must be bride, groom, or both." });
      return;
    }
    if (!rsvp) {
      issues.push({ row: rowNumber, message: "RSVP must be pending, yes, no, or maybe." });
      return;
    }
    if (plusOne === null) {
      issues.push({ row: rowNumber, message: "Plus one must be yes or no." });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ row: rowNumber, message: "Email address is invalid." });
      return;
    }

    guests.push({
      name,
      side,
      relationship: cell(raw.relationship) || null,
      phone: cell(raw.phone) || null,
      email: email || null,
      rsvp_status: rsvp,
      plus_one: plusOne,
      dietary: cell(raw.dietary) || null,
      address: cell(raw.address) || null,
      notes: cell(raw.notes) || null,
    });
  });

  if (rows.length > 501) {
    issues.push({ row: 502, message: "Only the first 500 guest rows can be imported at once." });
  }

  return { totalRows: rows.length - 1, guests, issues };
}
