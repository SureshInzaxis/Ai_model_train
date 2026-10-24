const { CorrectedQuestion, PDFDocument, Subject, Chapter } = require('../models');
const { Op } = require('sequelize');
const CorrectionService = require('../services/correctionService');

exports.listCorrected = async (req, res, next) => {
  try {
    const {
      subject, chapter, matchStatus, issueType, reviewStatus,
      stored, search, page = 1, limit = 20,
    } = req.query;
    const where = {};

    if (subject) where.subject_name = { [Op.iLike]: `%${subject}%` };
    if (chapter) where.chapter_name = { [Op.iLike]: `%${chapter}%` };
    if (matchStatus) where.match_status = matchStatus;
    if (issueType) where.issue_type = issueType;
    if (reviewStatus) where.review_status = reviewStatus;
    if (stored === 'true') where.stored_at = { [Op.ne]: null };
    if (stored === 'false') where.stored_at = { [Op.is]: null };
    if (search) {
      where[Op.or] = [
        { question_text: { [Op.iLike]: `%${search}%` } },
        { answer_key: { [Op.iLike]: `%${search}%` } },
        { subject_name: { [Op.iLike]: `%${search}%` } },
        { chapter_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await CorrectedQuestion.findAndCountAll({
      where,
      include: [
        { model: Subject, as: 'subject', required: false },
        { model: Chapter, as: 'chapter', required: false },
        { model: PDFDocument, as: 'pdf_document', attributes: ['id', 'filename'], required: false },
      ],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      order: [['id', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
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

exports.getCorrectedById = async (req, res, next) => {
  try {
    const row = await CorrectedQuestion.findByPk(req.params.id, {
      include: [
        { model: Subject, as: 'subject', required: false },
        { model: Chapter, as: 'chapter', required: false },
        { model: PDFDocument, as: 'pdf_document', required: false },
      ],
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Corrected question not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};

exports.approveCorrected = async (req, res, next) => {
  try {
    const row = await CorrectedQuestion.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Corrected question not found' });
    }
    await row.update({
      review_status: 'approved',
      needs_human_review: false,
      stored_at: new Date(),
    });
    res.json({ success: true, message: 'Stored in corrected question bank', data: row });
  } catch (err) {
    next(err);
  }
};

exports.editCorrected = async (req, res, next) => {
  try {
    const row = await CorrectedQuestion.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Corrected question not found' });
    }
    const {
      questionText, optionA, optionB, optionC, optionD,
      answerKey, explanation, subjectName, chapterName,
    } = req.body;

    await row.update({
      question_text: questionText ?? row.question_text,
      option_a: optionA ?? row.option_a,
      option_b: optionB ?? row.option_b,
      option_c: optionC ?? row.option_c,
      option_d: optionD ?? row.option_d,
      options_json: {
        A: optionA ?? row.option_a,
        B: optionB ?? row.option_b,
        C: optionC ?? row.option_c,
        D: optionD ?? row.option_d,
      },
      answer_key: answerKey ?? row.answer_key,
      explanation: explanation ?? row.explanation,
      subject_name: subjectName ?? row.subject_name,
      chapter_name: chapterName ?? row.chapter_name,
      review_status: 'edited',
      needs_human_review: false,
      stored_at: new Date(),
    });
    res.json({ success: true, message: 'Corrected question updated and stored', data: row });
  } catch (err) {
    next(err);
  }
};

exports.verifyOne = async (req, res, next) => {
  try {
    const row = await CorrectionService.verifyOne(parseInt(req.params.id, 10));
    if (!row) {
      return res.status(409).json({ success: false, message: 'Already running or not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};
