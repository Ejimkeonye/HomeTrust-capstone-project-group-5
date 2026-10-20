import { deflateSync, inflateSync } from 'zlib';
import { IInspection } from '../types';

export interface InspectionSignatureImage {
  role: 'Landlord' | 'Tenant';
  name: string;
  signedAt: string;
  contentType: 'image/png' | 'image/jpeg';
  bytes: Buffer;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}

function makeStream(dictionary: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(dictionary + '\nstream\n', 'ascii'),
    data,
    Buffer.from('\nendstream', 'ascii'),
  ]);
}

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodePng(bytes: Buffer): { width: number; height: number; data: Buffer } {
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat: Buffer[] = [];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (!width || !height || width > 4096 || height > 4096 || bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error('Unsupported PNG signature format');
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  if (inflated.length !== (stride + 1) * height) throw new Error('Invalid PNG signature image data');

  const rgb = Buffer.alloc(width * height * 3);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    const source = inflated.subarray(rowStart + 1, rowStart + 1 + stride);
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error('Invalid PNG signature filter');
      row[x] = (source[x] + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 3;
      const alpha = channels === 4 ? row[sourceIndex + 3] / 255 : 1;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[targetIndex + channel] = Math.round(row[sourceIndex + channel] * alpha + 255 * (1 - alpha));
      }
    }
    previous = row;
  }

  return { width, height, data: deflateSync(rgb) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error('Invalid JPEG signature image');
}

/** Build a printable report with both signed PNG/JPEG signature images embedded. */
export function createInspectionPdf(inspection: IInspection, signatures: InspectionSignatureImage[] = []): Buffer {
  const lines = [
    'HomeTrust Inspection Report',
    'Inspection: ' + inspection.inspectionId,
    'Property: ' + inspection.propertyId,
    'Status: ' + inspection.state,
    'Created: ' + inspection.createdAt,
    'Submitted: ' + (inspection.submittedAt || 'Not submitted'),
    'Acknowledged by: ' + (inspection.approvalCount || inspection.approvals?.length || 0) + ' parties',
    '',
    'Room items',
  ];
  for (const item of inspection.items || []) {
    lines.push(item.roomId + ' - ' + item.itemName + ': ' + item.condition);
    lines.push('Decision: ' + (item.reviewStatus || 'Pending') + (item.reviewedAt ? ' by ' + item.reviewedBy + ' at ' + item.reviewedAt : ''));
    if (item.reviewNote) lines.push('Review note: ' + item.reviewNote);
    if (item.notes) lines.push('Note: ' + item.notes);
    lines.push('Evidence files: ' + (item.evidence?.length || 0), '');
  }

  const pageStreams: Array<{ content: string; imageNames: string[] }> = [];
  for (let index = 0; index < lines.length; index += 48) {
    const pageLines = lines.slice(index, index + 48);
    const content = pageLines.map((line, lineIndex) =>
      'BT /F1 10 Tf 48 ' + (760 - lineIndex * 15) + ' Td (' + escapePdfText(line) + ') Tj ET',
    ).join('\n');
    pageStreams.push({ content, imageNames: [] });
  }
  if (pageStreams.length === 0) pageStreams.push({ content: 'BT /F1 12 Tf 48 740 Td (HomeTrust Inspection Report) Tj ET', imageNames: [] });

  const imageResources: Array<{ name: string; id: number; width: number; height: number; role: 'Landlord' | 'Tenant' }> = [];
  const bodies: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'),
    Buffer.alloc(0),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'),
  ];

  for (const [index, signature] of signatures.entries()) {
    let width: number;
    let height: number;
    let data: Buffer;
    let filter: string;
    if (signature.contentType === 'image/png') {
      const decoded = decodePng(signature.bytes);
      width = decoded.width;
      height = decoded.height;
      data = decoded.data;
      filter = '/FlateDecode';
    } else {
      const dimensions = jpegDimensions(signature.bytes);
      width = dimensions.width;
      height = dimensions.height;
      data = signature.bytes;
      filter = '/DCTDecode';
    }
    const name = 'Im' + (index + 1);
    const id = bodies.length + 1;
    const dictionary = '<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ' + filter + ' /Length ' + data.length + ' >>';
    bodies.push(makeStream(dictionary, data));
    imageResources.push({ name, id, width, height, role: signature.role });
  }

  const signatureParts = ['BT /F1 18 Tf 48 740 Td (Inspection signatures) Tj ET'];
  for (const role of ['Landlord', 'Tenant'] as const) {
    const signature = signatures.find((entry) => entry.role === role);
    const record = role === 'Landlord' ? inspection.landlordSignature : inspection.tenantSignature;
    const x = role === 'Landlord' ? 48 : 330;
    signatureParts.push('BT /F1 12 Tf ' + x + ' 700 Td (' + role + ') Tj ET');
    signatureParts.push('BT /F1 10 Tf ' + x + ' 680 Td (' + escapePdfText(record?.name || signature?.name || 'Not signed') + ') Tj ET');
    if (record?.signedAt || signature?.signedAt) {
      signatureParts.push('BT /F1 9 Tf ' + x + ' 664 Td (' + escapePdfText(record?.signedAt || signature!.signedAt) + ') Tj ET');
    }
    const image = imageResources.find((entry) => entry.role === role);
    if (image) {
      const scale = Math.min(220 / image.width, 130 / image.height);
      const drawWidth = Math.max(1, Math.round(image.width * scale));
      const drawHeight = Math.max(1, Math.round(image.height * scale));
      signatureParts.push('q ' + drawWidth + ' 0 0 ' + drawHeight + ' ' + x + ' 500 cm /' + image.name + ' Do Q');
    } else {
      signatureParts.push('BT /F1 10 Tf ' + x + ' 580 Td (Not signed) Tj ET');
    }
  }
  const signatureImageNames = imageResources.map((image) => image.name);
  pageStreams.push({ content: signatureParts.join('\n'), imageNames: signatureImageNames });

  const pageIds: number[] = [];
  for (const page of pageStreams) {
    const pageId = bodies.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const imageDictionary = page.imageNames.length
      ? ' /XObject << ' + imageResources
          .filter((image) => page.imageNames.includes(image.name))
          .map((image) => '/' + image.name + ' ' + image.id + ' 0 R')
          .join(' ') + ' >>'
      : '';
    const pageDictionary = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>' +
      imageDictionary + ' >> /Contents ' + contentId + ' 0 R >>';
    bodies.push(Buffer.from(pageDictionary, 'ascii'));
    const contentBytes = Buffer.from(page.content, 'ascii');
    bodies.push(makeStream('<< /Length ' + contentBytes.length + ' >>', contentBytes));
  }
  bodies[1] = Buffer.from('<< /Type /Pages /Kids [' + pageIds.map((id) => id + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>', 'ascii');

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  let offset = chunks[0].length;
  bodies.forEach((body, index) => {
    offsets.push(offset);
    const prefix = Buffer.from((index + 1) + ' 0 obj\n', 'ascii');
    const suffix = Buffer.from('\nendobj\n', 'ascii');
    chunks.push(prefix, body, suffix);
    offset += prefix.length + body.length + suffix.length;
  });
  const xrefOffset = offset;
  let xref = 'xref\n0 ' + (bodies.length + 1) + '\n0000000000 65535 f \n';
  for (const objectOffset of offsets.slice(1)) xref += String(objectOffset).padStart(10, '0') + ' 00000 n \n';
  xref += 'trailer\n<< /Size ' + (bodies.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  chunks.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(chunks);
}