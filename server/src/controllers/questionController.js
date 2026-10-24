const { Question, Subject, Chapter, PDFDocument, VerificationResult } = require('../models');
const logger = require('../config/logger');

exports.listQuestions = async (req, res, next) => {
  try {
    const {
      subject, chapter, year, examType, reviewStatus,
      issueType, needsReview, search, page = 1, limit = 20,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};
    const include = [
      { model: Subject, as: 'subject' },
      { model: Chapter, as: 'chapter' },
      { model: PDFDocument, as: 'pdf_document' },
    ];

    if (subject) where['$subject.code$'] = subject;
    if (chapter) where['$chapter.name$'] = chapter;
    if (year) where.exam_year = parseInt(year, 10);
    if (examType) where.exam_type = examType;
    if (reviewStatus) where.review_status = reviewStatus;
    if (issueType) where.issue_type = issueType;
    if (needsReview === 'true') where.needs_human_review = true;

    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { question_text: { [Op.like]: `%${search}%` } },
        { original_answer_key: { [Op.like]: `%${search}%` } },
        { verified_answer_key: { [Op.like]: `%${search}%` } },
        { approved_answer_key: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: questions } = await Question.findAndCountAll({
      where,
      include,
      limit: parseInt(limit, 10),
      offset,
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: questions,
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

exports.getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findByPk(req.params.id, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Chapter, as: 'chapter' },
        { model: PDFDocument, as: 'pdf_document' },
        {
          model: VerificationResult,
          as: 'verification_results',
          order: [['created_at', 'DESC']],
          limit: 10,
        },
      ],
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

exports.getQuestionByStableId = async (req, res, next) => {
  try {
    const question = await Question.findOne({
      where: { stable_id: req.params.stableId },
      include: [
        { model: Subject, as: 'subject' },
        { model: Chapter, as: 'chapter' },
        { model: PDFDocument, as: 'pdf_document' },
      ],
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

exports.listOptions = async (req, res, next) => {
  try {
    const subjects = await Subject.findAll({
      attributes: ['id', 'name', 'code'],
      order: [['sort_order', 'ASC']],
    });

    const chaptersBySubject = {};
    const subjectsList = await Subject.findAll({ include: [{ model: Chapter, as: 'chapters' }] });

    for (const subj of subjectsList) {
      chaptersBySubject[subj.code] = subj.chapters.map(c => ({ id: c.id, name: c.name, code: c.code }));
    }

    const examTypes = await Question.findAll({
      attributes: [[Question.sequelize.fn('DISTINCT', Question.sequelize.col('exam_type')), 'exam_type']],
      where: { exam_type: { [require('sequelize').Op.ne]: null } },
    });

    const years = await Question.findAll({
      attributes: [[Question.sequelize.fn('DISTINCT', Question.sequelize.col('exam_year')), 'exam_year']],
      where: { exam_year: { [require('sequelize').Op.ne]: null } },
      order: [['exam_year', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        subjects: (Array.isArray(subjects) ? subjects : []).map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })),
        chapters: chaptersBySubject,
        exam_types: examTypes.map(e => e.exam_type),
        years: years.map(y => y.exam_year),
      },
    });
  } catch (err) {
    next(err);
  }
};
