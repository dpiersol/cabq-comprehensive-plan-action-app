/**
 * The city's Word template sometimes splits placeholders across multiple `<w:r>` runs,
 * which breaks docxtemplater. We normalize those fragments to single `{tag}` runs and
 * rename tags to docxtemplater-friendly camelCase.
 *
 * Patterns must not span `</w:p>` — otherwise "Description" in a nearby heading can be matched by mistake.
 */
export function preprocessTemplateDocumentXml(xml: string): string {
  let out = xml;

  // {Legislation } + Description + } split across runs (same paragraph only)
  out = out.replace(
    /<w:t xml:space="preserve">\{Legislation <\/w:t><\/w:r>(?:(?!<\/w:p>)[\s\S])*?<w:t>Description<\/w:t><\/w:r>(?:(?!<\/w:p>)[\s\S])*?<w:t>\}<\/w:t>/,
    '<w:t xml:space="preserve">{legislationDescription}</w:t>',
  );

  // { + How does this legislation further the policies selected? + } (same paragraph only)
  out = out.replace(
    /<w:t>\{<\/w:t><\/w:r>(?:(?!<\/w:p>)[\s\S])*?<w:t>How does this legislation further the policies selected\?<\/w:t><\/w:r>(?:(?!<\/w:p>)[\s\S])*?<w:t>\}<\/w:t>/,
    '<w:t xml:space="preserve">{howDoesLegislationFurtherPolicies}</w:t>',
  );

  const simpleRenames: [string, string][] = [
    ["{Current Date}", "{currentDate}"],
    ["{Legislation Title}", "{legislationTitle}"],
    ["{Chapter Number}", "{chapterNumber}"],
    ["{Chapter Description}", "{chapterDescription}"],
    ["{Goal}", "{goal}"],
    ["{Goal Description}", "{goalDescription}"],
    ["{Policy}", "{policy}"],
    ["{Policy Description}", "{policyDescription}"],
  ];

  for (const [from, to] of simpleRenames) {
    out = out.split(from).join(to);
  }

  return out;
}
