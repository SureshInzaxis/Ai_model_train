const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../config/logger');
const redis = require('../config/redis');
const { sequelize } = require('../config/database');
const { PDFDocument, Question, ProcessingJob } = require('../models');
const PDFService = require('../services/pdfService');
const OCRService = require('../services/ocrService');
const QuestionParser = require('../services/questionParser');
const { computeFileHash } = require('../utils/fileHash');
const { generateStableId } = require('../utils/helpers');

const concurrency = parseInt(process.env.OCR_CONCURRENCY || '1', 10);

const worker = new Worker(
  'pdf:extraction',
  async (job) => {
    const { pdfDocumentId } = job.data;
    logger.info(`Starting extraction for PDF document ${pdfDocumentId}`);

    const pdfDoc = await PDFDocument.findByPk(pdfDocumentId);
    if (!pdfDoc) {
      throw new Error(`PDF document not found: ${pdfDocumentId}`);
    }

    const alreadyExtracted = await Question.count({ where: { pdf_document_id: pdfDocumentId } });
    if (alreadyExtracted > 0) {
      logger.info(`PDF ${pdfDocumentId} already extracted (${alreadyExtracted} questions). Matching against the question bank.`);
      const CorrectionService = require('../services/correctionService');
      await CorrectionService.analyzePdf(pdfDocumentId);
      await CorrectionService.verifyPdfInBackground(pdfDocumentId);
      return {
        pdfDocumentId,
        questionsExtracted: alreadyExtracted,
        skippedExtraction: true,
      };
    }

    const jobRecord = await ProcessingJob.create({
      job_type: 'extraction',
      pdf_document_id: pdfDocumentId,
      status: 'running',
      total_items: pdfDoc.page_count,
      concurrency,
      configuration: JSON.stringify({ model: 'extraction', pageCount: pdfDoc.page_count }),
      started_at: new Date(),
    });

    try {
      const filePath = pdfDoc.file_path;
      const fileExist = await fs.stat(filePath).catch(() => null);
      if (!fileExist) {
        throw new Error(`File not found on disk: ${filePath}`);
      }

      let extractionResult;
      try {
        extractionResult = await PDFService.extractText(filePath);
        const isScanned = PDFService.detectScannedPdf(extractionResult.text, extractionResult.numPages);

        if (isScanned) {
          logger.info(`PDF ${pdfDocumentId} appears to be scanned, initiating OCR`);
          pdfDoc.ocr_required = true;
          await pdfDoc.save();

          const ocrOutputDir = path.join(path.dirname(filePath), 'ocr_cache');
          await fs.mkdir(ocrOutputDir, { recursive: true });

          if (!OCRService.initialized) {
            await OCRService.initialize();
          }

          const ocrResult = await OCRService.processScannedPDF(filePath, ocrOutputDir, extractionResult.numPages);
          pdfDoc.ocr_confidence = ocrResult.averageConfidence;
          pdfDoc.extraction_warnings = JSON.stringify(ocrResult.pages
            .filter(p => p.warnings && p.warnings.length > 0)
            .map(p => ({ page: p.pageNumber, warnings: p.warnings })));

          const fullText = ocrResult.pages.map(p => p.text).join('\n\n');

          const allWarnings = [];
          const allQuestions = [];

          for (const page of ocrResult.pages) {
            const parsed = QuestionParser.parseQuestions(
              page.text,
              page.pageNumber,
              {
                subject: pdfDoc.subject_id,
                chapter: pdfDoc.chapter_id,
                examYear: pdfDoc.exam_year,
                examType: pdfDoc.exam_type,
                sourcePdf: pdfDoc.filename,
                extractionMethod: 'ocr',
              }
            );

            allQuestions.push(...parsed.questions);
            allWarnings.push(...parsed.warnings);
          }

          await saveQuestions(pdfDoc, allQuestions, allWarnings, jobRecord, job);
          await OCRService.terminate();
        } else {
          logger.info(`PDF ${pdfDocumentId} is text-based, extracting normally`);

          const pageTexts = extractionResult.text.split(/\f/).filter(t => t.trim().length > 0);
          const allQuestions = [];
          const allWarnings = [];

          pageTexts.forEach((pageText, idx) => {
            const parsed = QuestionParser.parseQuestions(
              pageText,
              idx + 1,
              {
                subject: pdfDoc.subject_id,
                chapter: pdfDoc.chapter_id,
                examYear: pdfDoc.exam_year,
                examType: pdfDoc.exam_type,
                sourcePdf: pdfDoc.filename,
                extractionMethod: 'text',
              }
            );
            allQuestions.push(...parsed.questions);
            allWarnings.push(...parsed.warnings);
          });

          pdfDoc.extraction_warnings = JSON.stringify([...new Set(allWarnings)]);
          await pdfDoc.save();
          await saveQuestions(pdfDoc, allQuestions, allWarnings, jobRecord, job);
        }
      } catch (extractError) {
        logger.error(`Extraction error for PDF ${pdfDocumentId}:`, extractError.message);
        pdfDoc.status = 'failed';
        pdfDoc.extraction_warnings = JSON.stringify({ error: extractError.message });
        await pdfDoc.save();
        jobRecord.status = 'failed';
        jobRecord.error = extractError.message;
        jobRecord.completed_at = new Date();
        await jobRecord.save();
        throw extractError;
      }

      pdfDoc.status = 'processed';
      pdfDoc.question_count = await Question.count({ where: { pdf_document_id: pdfDocumentId } });
      await pdfDoc.save();

      jobRecord.status = 'completed';
      jobRecord.processed_items = pdfDoc.page_count;
      jobRecord.completed_at = new Date();
      jobRecord.result = JSON.stringify({ extractedQuestions: pdfDoc.question_count });
      await jobRecord.save();

      logger.info(`Extraction complete for PDF ${pdfDocumentId}: ${pdfDoc.question_count} questions found`);

      try {
        const CorrectionService = require('../services/correctionService');
        await CorrectionService.analyzePdf(pdfDocumentId);
        await CorrectionService.verifyPdfInBackground(pdfDocumentId);
      } catch (analyzeErr) {
        logger.warn(`Bank matching failed after worker extraction: ${analyzeErr.message}`);
      }

      return {
        pdfDocumentId: pdfDoc.id,
        questionsExtracted: pdfDoc.question_count,
        pagesProcessed: pdfDoc.page_count,
      };
    } catch (error) {
      jobRecord.status = 'failed';
      jobRecord.error = error.message;
      jobRecord.completed_at = new Date();
      await jobRecord.save();
      throw error;
    }
  },
  {
    connection: redis.connection,
    concurrency,
    // @ts-ignore
    lockDuration: 300000,
  }
);

async function saveQuestions(pdfDoc, questions, warnings, jobRecord, job) {
  let savedCount = 0;
  let duplicateCount = 0;
  const batchSize = parseInt(process.env.JOB_BATCH_SIZE || '10', 10);

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    for (const q of batch) {
      try {
        const stableId = generateStableId();
        const existing = await Question.findOne({
          where: {
            question_number: q.question_number,
            pdf_document_id: pdfDoc.id,
          },
        });

        if (existing) {
          duplicateCount++;
          continue;
        }

        const question = await Question.create({
          stable_id: stableId,
          pdf_document_id: pdfDoc.id,
          page_number: q.page_number,
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
          options_json: JSON.stringify({
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d,
          }),
          original_answer_key: q.original_answer_key,
          original_explanation: q.original_explanation,
          extraction_method: q.metadata.extraction_method || 'text',
          ocr_confidence: q.ocr_confidence || null,
          extraction_warnings: JSON.stringify([...new Set(q.warnings || []), ...warnings]),
          extraction_flags: JSON.stringify({ uncertain: q.is_uncertain || false }),
          needs_human_review: q.is_uncertain || false,
          review_status: q.is_uncertain ? 'pending' : 'pending',
        });

        savedCount++;
        jobRecord.processed_items = (jobRecord.processed_items || 0) + 1;
        await jobRecord.save();
      } catch (saveError) {
        if (saveError.name === 'SequelizeUniqueConstraintError') {
          duplicateCount++;
        } else {
          logger.error(`Failed to save question:`, saveError.message);
        }
      }
    }
    await job.progress(i + batch.length, questions.length);
  }

  jobRecord.result = JSON.stringify({ savedCount, duplicateCount, totalParsed: questions.length });
  await jobRecord.save();

  return { saved: savedCount, duplicates: duplicateCount };
}

worker.on('completed', (job) => {
  logger.info(`Extraction worker completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Extraction worker failed job ${job.id}:`, err.message);
});

worker.on('error', (err) => {
  logger.error('Extraction worker error:', err.message);
});

logger.info('PDF extraction worker started');

module.exports = worker;
