const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { spawn } = require('child_process');
const { PDFDocument, Question } = require('../models');
const { generateStableId } = require('../utils/helpers');

async function processPdfDirectly(pdfId) {
  const pdfDoc = await PDFDocument.findByPk(pdfId);
  if (!pdfDoc) {
    console.error('PDF not found:', pdfId);
    return;
  }

  // Delete previous incorrect extractions for this PDF
  await Question.destroy({ where: { pdf_document_id: pdfId } });

  const scriptPath = path.resolve(__dirname, 'extract_questions.py');
  const diagramsDir = path.resolve(__dirname, '../../uploads/diagrams');

  console.log('Running Python extractor for:', pdfDoc.filename);
  const py = spawn('python', [scriptPath, pdfDoc.file_path, diagramsDir]);
  let stdout = '';
  let stderr = '';

  py.stdout.on('data', (d) => { stdout += d.toString(); });
  py.stderr.on('data', (d) => { stderr += d.toString(); });

  py.on('close', async (code) => {
    if (code !== 0) {
      console.error('Python error:', stderr);
      process.exit(1);
    }

    const questions = JSON.parse(stdout);
    console.log('Extracted ' + questions.length + ' clean questions from PDF.');

    let saved = 0;
    for (const q of questions) {
      const stableId = generateStableId();
      await Question.create({
        stable_id: stableId,
        pdf_document_id: pdfDoc.id,
        page_number: q.page_number || 1,
        subject_id: pdfDoc.subject_id,
        chapter_id: pdfDoc.chapter_id,
        exam_year: pdfDoc.exam_year,
        exam_type: pdfDoc.exam_type,
        source: pdfDoc.source,
        question_number: q.question_number,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        options_json: q.options_json,
        original_answer_key: q.original_answer_key,
        original_explanation: q.original_explanation,
        metadata: q.diagram_url ? { diagram_url: q.diagram_url } : null,
        extraction_method: 'text',
        review_status: 'pending',
        needs_human_review: true,
      });
      saved++;
    }

    pdfDoc.status = 'processed';
    pdfDoc.question_count = saved;
    await pdfDoc.save();

    console.log('Successfully saved ' + saved + ' extracted questions for PDF #' + pdfDoc.id + '!');
    process.exit(0);
  });
}

const targetPdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 3;
processPdfDirectly(targetPdfId).catch(err => {
  console.error(err);
  process.exit(1);
});
