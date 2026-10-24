const request = require('supertest');
const path = require('path');
const app = require('../src/app');
const fs = require('fs');

describe('PDF Upload & Management', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testPdfPath = path.join(fixturesDir, 'small_test.pdf');

  beforeAll(async () => {
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    if (!fs.existsSync(testPdfPath)) {
      const minimalPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        '/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n' +
        '4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Test PDF) Tj ET\nendstream\nendobj\n' +
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \n' +
        'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n423\n%%EOF\n'
      );
      fs.writeFileSync(testPdfPath, minimalPdf);
    }
  });

  it('should reject non-PDF file uploads', async () => {
    const res = await request(app)
      .post('/api/pdfs/upload')
      .attach('pdfs', Buffer.from('not a pdf'), 'test.txt');

    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when no files uploaded', async () => {
    const res = await request(app)
      .post('/api/pdfs/upload')
      .field('subject', 'PHY');

    expect(res.statusCode).toBe(400);
  });

  it('should list PDFs', async () => {
    const res = await request(app).get('/api/pdfs');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject upload with invalid subject', async () => {
    const res = await request(app)
      .post('/api/pdfs/upload')
      .attach('pdfs', Buffer.from('fake pdf content'), 'test.pdf')
      .field('subject', 'INVALID_SUBJECT');

    expect(res.statusCode).toBe(400);
  });
});
