import PDFDocument from 'pdfkit';
import { IEvidence, IInspection, IProperty } from '../types';

export interface InspectionSignatureImage {
  role: 'Landlord' | 'Tenant';
  name: string;
  signedAt: string;
  contentType: 'image/png' | 'image/jpeg';
  bytes: Buffer;
}

export interface InspectionEvidenceImage {
  evidenceId: string;
  roomItemId: string;
  filename: string;
  type: IEvidence['type'];
  uploadedBy?: string;
  createdAt?: string;
  contentType?: string;
  bytes?: Buffer;
  omittedReason?: string;
}

const formatDate = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
};
const readable = (value?: string | number | null) =>
  value === undefined || value === null || value === '' ? 'Not recorded' : String(value);
const conditionLabel = (value?: string) =>
  ({ no_issue: 'No issue', stains: 'Stains', cracks: 'Cracks', broken: 'Broken' }[value || ''] || 'Not recorded');
const statusLabel = (value?: string) =>
  ({ ACCEPTED: 'Accepted', DISPUTED: 'Disputed' }[value || ''] || 'Pending review');
const supportedImage = (image: InspectionEvidenceImage) =>
  Boolean(image.bytes && ['image/jpeg', 'image/png'].includes(image.contentType || ''));

/** Creates a multi-page PDF with property, inspection, item, evidence and signature details. */
export function createInspectionPdf(
  inspection: IInspection,
  property?: IProperty,
  signatures: InspectionSignatureImage[] = [],
  evidenceImages: InspectionEvidenceImage[] = [],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, right: 48, bottom: 56, left: 48 }, autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (height: number) => { if (doc.y + height > bottom()) doc.addPage(); };
    const section = (title: string) => {
      ensureSpace(34);
      doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).fillColor('#17324d').text(title);
      doc.moveDown(0.25).strokeColor('#d8e1e8').moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
      doc.moveDown(0.45).fillColor('#202a33').font('Helvetica').fontSize(9.5);
    };
    const field = (label: string, value: unknown) => {
      const startY = doc.y;
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(readable(value as string), { width: pageWidth });
      if (doc.y === startY) doc.moveDown(0.2);
    };
    const paragraph = (label: string, value?: string) => {
      if (!value) return;
      ensureSpace(30);
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value, { width: pageWidth });
      doc.moveDown(0.25);
    };

    // --- Cover / header ---
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#17324d').text('HomeCompa Inspection Report');
    doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor('#52616d').text('Property condition record and evidence summary');
    doc.moveDown(1).fillColor('#202a33').fontSize(10);

    // --- Property details ---
    section('Property details');
    field('Property name', property?.name || 'Property details unavailable');
    field('Address', property?.address);
    if (property?.flatNo) field('Flat / unit', property.flatNo);
    field('Property ID', inspection.propertyId);

    // --- Inspection details ---
    section('Inspection details');
    field('Inspection ID', inspection.inspectionId);
    field('Status', inspection.state);
    field('Mode', inspection.mode);
    field('Created', formatDate(inspection.createdAt));
    field('Last updated', formatDate(inspection.updatedAt));
    field('Submitted', formatDate(inspection.submittedAt));
    field('Acknowledgements', `${inspection.approvalCount ?? inspection.approvals?.length ?? 0} recorded`);

    // --- Room items ---
    section(`Room items (${inspection.items?.length || 0})`);
    const items = inspection.items || [];
    if (!items.length) doc.text('No room items were recorded for this inspection.').moveDown(0.5);
    items.forEach((item, index) => {
      ensureSpace(100);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#17324d').text(
        `${index + 1}. ${readable(item.roomId)} — ${readable(item.itemName)}`,
      );
      doc.moveDown(0.25).font('Helvetica').fontSize(9.5).fillColor('#202a33');
      field('Condition rating', conditionLabel(item.condition));
      field('Review decision', statusLabel(item.reviewStatus));
      if (item.reviewedBy) field('Reviewed by', item.reviewedBy);
      if (item.reviewedAt) field('Reviewed at', formatDate(item.reviewedAt));
      paragraph('Inspection comments', item.notes);
      paragraph('Review comments', item.reviewNote);
      if (item.dispute) {
        paragraph(
          'Dispute details',
          typeof item.dispute === 'string' ? item.dispute : JSON.stringify(item.dispute),
        );
      }

      const knownEvidence = item.evidence || [];
      if (knownEvidence.length) {
        doc.font('Helvetica-Bold').text(`Evidence files (${knownEvidence.length})`);
        doc.font('Helvetica').fontSize(8.5);
        knownEvidence.forEach((evidence, evidenceIndex) => {
          const image = evidenceImages.find(candidate => candidate.evidenceId === evidence.evidenceId);
          const filename = (evidence as any).filename || evidence.evidenceId || `Evidence ${evidenceIndex + 1}`;
          ensureSpace(20);
          doc.text(
            `• ${filename} — ${evidence.type || 'file'}; uploaded ${
              formatDate(evidence.createdAt)}${evidence.uploadedBy ? `; by ${evidence.uploadedBy}` : ''}`,
          );
          if (image?.omittedReason) {
            doc.fillColor('#7a4b00').text(`  Photo not embedded: ${image.omittedReason}`).fillColor('#202a33');
          }
          if (image && supportedImage(image)) {
            ensureSpace(190);
            try {
              doc.image(image.bytes!, { fit: [pageWidth, 165], align: 'left', valign: 'center' });
              doc.moveDown(0.3);
            } catch {
              doc.fontSize(8).text('  Image could not be rendered in the PDF.');
            }
          }
        });
        doc.fontSize(9.5).moveDown(0.5);
      } else {
        doc.font('Helvetica').fontSize(9).text('Evidence files: None recorded').moveDown(0.4);
      }
      doc
        .moveDown(0.45)
        .strokeColor('#e3e8ed')
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke()
        .moveDown(0.5);
    });

    // --- Signatures ---
    section('Signatures');
    for (const role of ['Landlord', 'Tenant'] as const) {
      const signature = signatures.find(item => item.role === role);
      ensureSpace(95);
      doc.font('Helvetica-Bold').fontSize(10).text(role);
      if (!signature) {
        doc.font('Helvetica').fontSize(9).text('No saved signature available.').moveDown(0.5);
        continue;
      }
      doc.font('Helvetica').fontSize(9).text(`Name: ${signature.name || 'Not recorded'}`);
      doc.text(`Signed at: ${formatDate(signature.signedAt)}`);
      try {
        doc.image(signature.bytes, { fit: [190, 65], align: 'left' });
      } catch {
        doc.text('Signature image could not be displayed; signature record is listed above.');
      }
      doc.moveDown(0.6);
    }

    // --- Video evidence notice ---
    if (evidenceImages.some(image => image.type === 'video')) {
      section('Video evidence');
      doc.text(
        'Video files cannot be embedded as playable media in this PDF. File records are included under the relevant room item.',
      );
    }

    // Add consistent page numbers after all content is laid out.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#6b7780').text(
        `HomeCompa • Inspection ${inspection.inspectionId} • Page ${i + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 32,
        { width: pageWidth, align: 'center', lineBreak: false },
      );
    }
    doc.end();
  });
}