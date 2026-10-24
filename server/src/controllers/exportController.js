const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const { Question, Subject, Chapter, PDFDocument } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

exports.exportQuestions = async (req, res, next) => {
  try {
    const { format = 'csv', subject, chapter, year, examType, reviewStatus, ...filters } = req.query;

    const where = {};
    if (subject) where['$subject.code$'] = subject;
    if (chapter) where['$chapter.name$'] = chapter;
    if (year) where.exam_year = parseInt(year, 10);
    if (examType) where.exam_type = examType;
    if (reviewStatus) where.review_status = reviewStatus;

    const include = [
      { model: Subject, as: 'subject', attributes: ['name', 'code'] },
      { model: Chapter, as: 'chapter', attributes: ['name'] },
      { model: PDFDocument, as: 'pdf_document', attributes: ['filename', 'exam_year', 'exam_type', 'source'] },
    ];

    const questions = await Question.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 10000,
    });

    const flattened = questions.map(q => ({
      stable_id: q.stable_id,
      question_number: q.question_number,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      original_answer_key: q.original_answer_key,
      original_explanation: q.original_explanation,
      verified_answer: q.verified_answer_key,
      suggested_explanation: q.suggested_explanation,
      approved_answer: q.approved_answer_key,
      approved_explanation: q.approved_explanation,
      ai_confidence: q.ai_confidence,
      review_status: q.review_status,
      extraction_method: q.extraction_method,
      ocr_confidence: q.ocr_confidence,
      subject: q.subject?.name,
      chapter: q.chapter?.name,
      exam_year: q.exam_year,
      exam_type: q.exam_type,
      source: q.source,
      page_number: q.page_number,
      pdf_filename: q.pdf_document?.filename,
      created_at: q.created_at,
    }));

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Questions');
      worksheet.columns = Object.keys(flattened[0] || { stable_id: '' }).map(key => ({ header: key, key, width: 30 }));
      worksheet.addRows(flattened);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="questions_export_${Date.now()}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } else {
      const parser = new Parser({
        fields: Object.keys(flattened[0] || { stable_id: '' }),
        transforms: [
          (field, row) => {
            if (typeof row[field] === 'object' && row[field] !== null) {
              return JSON.stringify(row[field]);
            }
            if (row[field] === undefined || row[field] === null) {
              return '';
            }
            return row[field];
          },
        ],
      });

      const csv = parser.parse(flattened);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="questions_export_${Date.now()}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    next(err);
  }
};

exports.exportReviewQueue = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const where = { needs_human_review: true };

    const include = [
      { model: Subject, as: 'subject', attributes: ['name', 'code'] },
      { model: Chapter, as: 'chapter', attributes: ['name'] },
    ];

    const questions = await Question.findAll({ where, include, order: [['created_at', 'DESC']] });

    const data = questions.map(q => ({
      stable_id: q.stable_id,
      question_number: q.question_number,
      question_text: q.question_text,
      original_answer_key: q.original_answer_key,
      verified_answer: q.verified_answer_key,
      ai_confidence: q.ai_confidence,
      issue_type: q.issue_type,
      review_status: q.review_status,
      subject: q.subject?.name,
      chapter: q.chapter?.name,
    }));

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Review Queue');
      if (data.length > 0) {
        worksheet.columns = Object.keys(data[0]).map(key => ({ header: key, key, width: 30 }));
        worksheet.addRows(data);
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="review_queue_${Date.now()}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="review_queue_${Date.now()}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    next(err);
  }
};
