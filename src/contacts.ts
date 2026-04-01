export interface ContactBlock {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export function emptyContact(): ContactBlock {
  return { name: "", role: "", email: "", phone: "" };
}
