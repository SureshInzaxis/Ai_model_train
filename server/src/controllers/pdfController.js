const fs = require('fs');
const path = require('path');
const { PDFDocument, Question, Subject, Chapter, ProcessingJob } = require('../models');
const { upload } = require('../config/upload');
const { computeFileHash } = require('../utils/fileHash');
const logger = require('../config/logger');
const queueManager = require('../jobs/queueManager');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

exports.uploadPdf = async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No PDF files uploaded' });
      }

      const results = [];
      const duplicates = [];

      for (const file of req.files) {
        try {
          const fileHash = await computeFileHash(file.path);

          const existing = await PDFDocument.findOne({ where: { file_hash: fileHash } });
          if (existing) {
            duplicates.push({ filename: file.originalname, existingId: existing.id });
            await fs.promises.unlink(file.path).catch(() => {});
            results.push({
              filename: file.originalname,
              status: 'duplicate',
              message: `Duplicate of existing PDF (ID: ${existing.id})`,
            });
            continue;
          }

          const subject = await Subject.findOne({ where: { code: req.body.subject } });
          if (!subject) {
            throw new Error(`Subject not found: ${req.body.subject}`);
          }

          let chapter = null;
          if (req.body.chapter) {
            chapter = await Chapter.findOne({
              where: { subject_id: subject.id, name: req.body.chapter },
            });
          }

          const storedFilename = `${fileHash.substring(0, 32)}${path.extname(file.originalname)}`;
          const newPath = path.join(UPLOAD_DIR, storedFilename);

          if (file.path !== newPath) {
            await fs.promises.rename(file.path, newPath);
          }

          const pdfDoc = await PDFDocument.create({
            filename: file.originalname,
            stored_filename: storedFilename,
            file_path: newPath,
            file_hash: fileHash,
            file_size: file.size,
            subject_id: subject.id,
            chapter_id: chapter ? chapter.id : null,
            exam_year: req.body.examYear ? parseInt(req.body.examYear, 10) : null,
            exam_type: req.body.examType || null,
            source: req.body.source || null,
            page_count: 0,
            question_count: 0,
            ocr_required: false,
            status: 'uploaded',
            uploaded_at: new Date(),
          });

          results.push({
            filename: file.originalname,
            id: pdfDoc.id,
            status: 'uploaded',
            storedFilename: storedFilename,
            message: 'PDF uploaded successfully',
          });

          // Always extract using intelligent Python extractor
          setImmediate(async () => {
            try {
              const { spawn } = require('child_process');
              const { generateStableId } = require('../utils/helpers');
              const scriptPath = path.resolve(__dirname, '../scripts/extract_questions.py');
              const diagramsDir = path.resolve(__dirname, '../../uploads/diagrams');

              logger.info(`Starting Python question extraction for PDF ${pdfDoc.id}: ${pdfDoc.filename}`);
              pdfDoc.status = 'processing';
              await pdfDoc.save();

              // Run Python extractor
              const runPythonExtractor = () => {
                return new Promise((resolve, reject) => {
                  const py = spawn('python', [scriptPath, newPath, diagramsDir]);
                  let stdout = '';
                  let stderr = '';

                  py.stdout.on('data', (d) => { stdout += d.toString(); });
                  py.stderr.on('data', (d) => { stderr += d.toString(); });

                  py.on('close', (code) => {
                    if (code === 0) {
                      try {
                        const parsed = JSON.parse(stdout);
                        resolve(parsed);
                      } catch (e) {
                        reject(new Error(`Failed to parse Python JSON output: ${e.message}`));
                      }
                    } else {
                      reject(new Error(`Python extractor exited with code ${code}: ${stderr}`));
                    }
                  });
                });
              };

              let extractedQuestions = [];
              try {
                extractedQuestions = await runPythonExtractor();
              } catch (pyErr) {
                logger.warn(`Python extractor failed, falling back to JS parser: ${pyErr.message}`);
                const PDFService = require('../services/pdfService');
                const QuestionParser = require('../services/questionParser');
                const extractionResult = await PDFService.extractText(newPath);
                const jsParsed = QuestionParser.parseQuestions(extractionResult.text, 1, {
                  subject: subject.id,
                  chapter: chapter ? chapter.id : null,
                  examYear: pdfDoc.exam_year,
                  examType: pdfDoc.exam_type,
                  sourcePdf: pdfDoc.filename,
                  extractionMethod: 'text',
                });
                extractedQuestions = jsParsed.questions;
              }

              let saved = 0;
              for (const q of extractedQuestions) {
                const stableId = generateStableId();
                await Question.create({
                  stable_id: stableId,
                  pdf_document_id: pdfDoc.id,
                  page_number: q.page_number || 1,
                  subject_id: subject.id,
                  chapter_id: chapter ? chapter.id : null,
                  exam_year: pdfDoc.exam_year,
                  exam_type: pdfDoc.exam_type,
                  source: pdfDoc.source,
                  question_number: q.question_number || String(saved + 1),
                  question_text: q.question_text,
                  option_a: q.option_a,
                  option_b: q.option_b,
                  option_c: q.option_c,
                  option_d: q.option_d,
                  options_json: q.options_json || { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
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
              pdfDoc.page_count = extractedQuestions.length > 0 ? (extractedQuestions[extractedQuestions.length - 1].page_number || 1) : 1;
              await pdfDoc.save();
              logger.info(`Extraction complete for PDF ${pdfDoc.id}: ${saved} clean questions saved`);

              try {
                const CorrectionService = require('../services/correctionService');
                await CorrectionService.analyzePdf(pdfDoc.id);
                await CorrectionService.verifyPdfInBackground(pdfDoc.id);
                logger.info(`Matched PDF ${pdfDoc.id} against the question bank and queued Qwen checks`);
              } catch (analyzeErr) {
                logger.warn(`Bank matching failed for PDF ${pdfDoc.id}: ${analyzeErr.message}`);
              }

              queueManager.addExtractionJob({
                pdfDocumentId: pdfDoc.id,
                filePath: newPath,
                subjectId: subject.id,
                chapterId: chapter ? chapter.id : null,
                examYear: pdfDoc.exam_year,
                examType: pdfDoc.exam_type,
                source: pdfDoc.source,
              }).catch(() => {});
            } catch (extractErr) {
              logger.error(`Extraction failed for PDF ${pdfDoc.id}: ${extractErr.message}`);
              pdfDoc.status = 'failed';
              await pdfDoc.save().catch(() => {});
            }
          });
        } catch (err) {
          logger.error(`Failed to process file ${file.originalname}:`, err.message);
          await fs.promises.unlink(file.path).catch(() => {});
          results.push({
            filename: file.originalname,
            status: 'error',
            message: err.message,
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `Uploaded ${results.filter(r => r.status === 'uploaded').length} PDFs, ${duplicates.length} duplicates`,
        results,
        duplicates,
      });
    } catch (err) {
      next(err);
    }
};

exports.listPdfs = async (req, res, next) => {
  try {
    const { subject, chapter, examType, year, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};
    const include = [
      { model: Subject, as: 'subject' },
      { model: Chapter, as: 'chapter' },
    ];

    if (subject) where['$subject.code$'] = subject;
    if (chapter) where['$chapter.name$'] = chapter;
    if (examType) where.exam_type = examType;
    if (year) where.exam_year = parseInt(year, 10);
    if (status) where.status = status;

    const { count, rows: pdfs } = await PDFDocument.findAndCountAll({
      where,
      include,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: pdfs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        pages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPdfById = async (req, res, next) => {
  try {
    const pdf = await PDFDocument.findByPk(req.params.id, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Chapter, as: 'chapter' },
      ],
    });

    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found' });
    }

    const jobs = await ProcessingJob.findAll({
      where: { pdf_document_id: pdf.id },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    res.json({ success: true, data: { ...pdf.toJSON(), jobs } });
  } catch (err) {
    next(err);
  }
};

exports.getPageImage = async (req, res, next) => {
  try {
    const pdfId = req.params.pdfId || req.params.id;
    const { pageNumber } = req.params;
    const pdf = await PDFDocument.findByPk(pdfId);

    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found' });
    }

    const pageImageDir = path.join(path.dirname(pdf.file_path), 'page_cache');
    await fs.promises.mkdir(pageImageDir, { recursive: true });
    const imagePath = path.join(pageImageDir, `page_${pageNumber}.png`);

    if (!fs.existsSync(imagePath)) {
      const PDFService = require('../services/pdfService');
      try {
        await PDFService.renderPageWithPdf2pic(
          pdf.file_path,
          parseInt(pageNumber, 10),
          imagePath
        );
      } catch (renderErr) {
        logger.error(`Page render failed: ${renderErr.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to render PDF page. Poppler may not be installed.',
          error: renderErr.message,
        });
      }
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="page_${pageNumber}.png"`);
    fs.createReadStream(imagePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

exports.viewFile = async (req, res, next) => {
  try {
    const pdf = await PDFDocument.findByPk(req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found' });
    }

    if (!fs.existsSync(pdf.file_path)) {
      return res.status(404).json({ success: false, message: 'PDF file not found on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdf.filename)}"`);
    fs.createReadStream(pdf.file_path).pipe(res);
  } catch (err) {
    next(err);
  }
};

exports.comparePdf = async (req, res, next) => {
  try {
    const CorrectionService = require('../services/correctionService');
    const result = await CorrectionService.getPdfAnalysis(req.params.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.analyzePdf = async (req, res, next) => {
  try {
    const CorrectionService = require('../services/correctionService');
    const result = await CorrectionService.analyzePdf(req.params.id);
    res.json({
      success: true,
      message: 'PDF questions matched against the 50k database',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPdf = async (req, res, next) => {
  try {
    const CorrectionService = require('../services/correctionService');
    const queued = await CorrectionService.verifyPdfInBackground(req.params.id);
    res.json({
      success: true,
      message: `Qwen verification started for ${queued.queued} questions`,
      data: queued,
    });
  } catch (err) {
    next(err);
  }
};

exports.saveCorrected = async (req, res, next) => {
  try {
    const CorrectionService = require('../services/correctionService');
    const result = await CorrectionService.storePdf(req.params.id);
    res.json({
      success: true,
      message: `Stored ${result.stored} questions in the corrected question bank`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.deletePdf = async (req, res, next) => {
  try {
    const pdf = await PDFDocument.findByPk(req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF document not found' });
    }

    // Unlink the questions from this PDF document so database questions remain completely intact
    await Question.update(
      { pdf_document_id: null },
      { where: { pdf_document_id: pdf.id } }
    );

    // Delete associated processing jobs if any
    await ProcessingJob.destroy({ where: { pdf_document_id: pdf.id } }).catch(() => {});

    // Delete physical file on disk if it exists
    if (pdf.file_path && fs.existsSync(pdf.file_path)) {
      await fs.promises.unlink(pdf.file_path).catch((err) => {
        logger.warn(`Could not delete file ${pdf.file_path}: ${err.message}`);
      });
    }

    // Delete the PDF record from the pdf_documents table
    await pdf.destroy();

    logger.info(`PDF document #${pdf.id} (${pdf.filename}) deleted successfully. Associated questions preserved in DB.`);

    res.json({
      success: true,
      message: `PDF '${pdf.filename}' deleted successfully. Questions remain saved in the database.`,
    });
  } catch (err) {
    next(err);
  }
};



