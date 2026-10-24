const { Question, PDFDocument, Subject, Chapter, ImportJob } = require('../models');
const { generateStableId } = require('../utils/helpers');
const { upload } = require('../config/upload');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');

exports.importQuestions = [
  upload.single('importFile', { filename: (req, file, cb) => cb(null, `import_${Date.now()}${path.extname(file.originalname)}`) }),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No import file provided' });
      }

      const { format, subject, chapter } = req.body;
      const filePath = req.file.path;

      const importJob = await ImportJob.create({
        import_type: format || 'csv',
        filename: req.file.originalname,
        file_path: filePath,
        total_rows: 0,
        status: 'running',
        started_at: new Date(),
      });

      try {
        const subjectRecord = subject ? await Subject.findOne({ where: { code: subject } }) : null;
        const chapterRecord = chapter && subjectRecord
          ? await Chapter.findOne({ where: { subject_id: subjectRecord.id, name: chapter } })
          : null;

        let rows;
        if (format === 'csv' || req.file.mimetype.includes('csv')) {
          rows = await this.parseCSV(filePath);
        } else if (format === 'excel' || req.file.mimetype.includes('excel') || req.file.mimetype.includes('spreadsheet')) {
          rows = await this.parseExcel(filePath);
        } else {
          rows = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        }

        importJob.total_rows = rows.length;
        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const existing = await Question.findOne({
              where: {
                question_number: row.question_number || row.questionNumber,
                source: row.source || '',
              },
            });

            if (existing) {
              duplicateCount++;
              continue;
            }

            if (!row.question_text && !row.questionText) {
              errorCount++;
              errors.push({ row: i + 1, error: 'Missing question text' });
              continue;
            }

            await Question.create({
              stable_id: generateStableId(),
              subject_id: subjectRecord ? subjectRecord.id : (row.subject_id || null),
              chapter_id: chapterRecord ? chapterRecord.id : (row.chapter_id || null),
              exam_year: parseInt(row.exam_year || row.examYear || 0, 10) || null,
              exam_type: row.exam_type || row.examType || null,
              source: row.source || 'import',
              question_number: row.question_number || row.questionNumber || '',
              question_text: row.question_text || row.questionText || '',
              option_a: row.option_a || row.optionA || null,
              option_b: row.option_b || row.optionB || null,
              option_c: row.option_c || row.optionC || null,
              option_d: row.option_d || row.optionD || null,
              original_answer_key: row.answer_key || row.originalAnswerKey || row.correct_answer || null,
              original_explanation: row.explanation || row.originalExplanation || null,
              extraction_method: 'import',
              needs_human_review: false,
              review_status: 'approved',
              approved_answer_key: row.answer_key || row.originalAnswerKey || row.correct_answer || null,
              approved_explanation: row.explanation || row.originalExplanation || null,
            });

            successCount++;
          } catch (err) {
            errorCount++;
            errors.push({ row: i + 1, error: err.message });
          }

          importJob.processed_rows = i + 1;
          await importJob.save();
        }

        importJob.success_count = successCount;
        importJob.duplicate_count = duplicateCount;
        importJob.error_count = errorCount;
        importJob.status = 'completed';
        importJob.errors = errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null;
        importJob.completed_at = new Date();
        await importJob.save();

        res.json({
          success: true,
          message: `Import complete: ${successCount} imported, ${duplicateCount} duplicates, ${errorCount} errors`,
          data: {
            importJobId: importJob.id,
            totalRows: rows.length,
            successCount,
            duplicateCount,
            errorCount,
            errors: errors.slice(0, 10),
          },
        });
      } catch (parseErr) {
        importJob.status = 'failed';
        importJob.error = parseErr.message;
        importJob.completed_at = new Date();
        await importJob.save();
        throw parseErr;
      }
    } catch (err) {
      next(err);
    }
  },
];

exports.parseCSV = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const parser = new Parser({ headers: true });
  const json = parser.parse(content);
  return JSON.parse(json);
};

exports.parseExcel = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        rows[0] = rows[0] || {};
        rows[0][cell.text.toLowerCase().replace(/\s+/g, '_')] = cell.text;
      });
    } else {
      const obj = {};
      row.eachCell((cell) => {
        const header = worksheet.getRow(1).getCell(cell.col).text.toLowerCase().replace(/\s+/g, '_');
        obj[header] = cell.text;
      });
      rows.push(obj);
    }
  });
  return rows.slice(1);
};
