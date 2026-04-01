/**
 * City of Albuquerque department list (from `public/data/CoA_Department_List.csv`).
 * Sorted ascending A–Z. After editing the CSV, sync the `RAW` array here (or regenerate).
 */
const RAW: string[] = [
  "Animal Welfare",
  "Arts and Culture",
  "Aviation",
  "CAO",
  "City Clerk",
  "City Council",
  "Community Safety",
  "Economic Development",
  "Environmental Health",
  "Finance and Administration",
  "Fire",
  "General Services",
  "Health Housing and Homelessness",
  "Human Resources",
  "Inspector General",
  "Internal Audit",
  "Legal",
  "Metro Redevelopment Agency",
  "Municipal Development",
  "Office of Emergency Management",
  "Office of Equity and Inclusion",
  "Parks and Recreation",
  "Planning",
  "Police",
  "Police Oversight",
  "Senior Affairs",
  "Solid Waste",
  "Tech and Innovation",
  "Transit",
  "User Test",
  "Youth and Family Services",
];

export const COA_DEPARTMENTS: readonly string[] = [...RAW].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }),
);
