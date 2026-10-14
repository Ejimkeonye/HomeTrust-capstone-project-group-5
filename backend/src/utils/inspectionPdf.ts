import { IInspection } from '../types';

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}

/** Build a dependency-free, printable summary PDF for the inspection screens. */
export function createInspectionPdf(inspection: IInspection): Buffer {
  const lines = [
    'HomeTrust Inspection Report',
    `Inspection: ${inspection.inspectionId}`,
    `Property: ${inspection.propertyId}`,
    `Status: ${inspection.state}`,
    `Created: ${inspection.createdAt}`,
    `Submitted: ${inspection.submittedAt || 'Not submitted'}`,
    `Acknowledged by: ${inspection.approvalCount || inspection.approvals?.length || 0} parties`,
    '',
    'Room items',
  ];
  for (const item of inspection.items || []) {
    lines.push(`${item.roomId} - ${item.itemName}: ${item.condition}`);
    lines.push(`Decision: ${item.reviewStatus || 'Pending'}${item.reviewedAt ? ` by ${item.reviewedBy} at ${item.reviewedAt}` : ''}`);
    if (item.reviewNote) lines.push(`Review note: ${item.reviewNote}`);
    if (item.notes) lines.push(`Note: ${item.notes}`);
    lines.push(`Evidence files: ${item.evidence?.length || 0}`, '');
  }

  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));
  if (pages.length === 0) pages.push(['HomeTrust Inspection Report']);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  const fontObjectId = 3 + pages.length * 2;
  for (const [pageIndex, page] of pages.entries()) {
    const pageId = 3 + pageIndex * 2;
    const stream = page.map((line, lineIndex) =>
      `BT /F1 10 Tf 48 ${760 - lineIndex * 15} Td (${escapePdfText(line)}) Tj ET`,
    ).join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}
