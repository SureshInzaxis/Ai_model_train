const { Question, ReviewHistory, VerificationResult } = require('../models');
const logger = require('../config/logger');

exports.getReviewQueue = async (req, res, next) => {
  try {
    const { subject, chapter, issueType, confidence, page = 1, limit = 20 } = req.query;
    const { Op } = require('sequelize');
    const where = { needs_human_review: true };

    if (subject) where['$subject.code$'] = subject;
    if (chapter) where['$chapter.name$'] = chapter;

    const include = [
      { model: require('../models').Subject, as: 'subject' },
      { model: require('../models').Chapter, as: 'chapter' },
      {
        model: VerificationResult,
        as: 'verification_results',
        order: [['created_at', 'DESC']],
        limit: 1,
      },
    ];

    if (confidence) {
      where.ai_confidence = { [Op.lt]: parseInt(confidence, 10) };
    }

    const { count, rows: questions } = await Question.findAndCountAll({
      where,
      include,
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
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

exports.approveSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, reason } = req.body;

    const question = await Question.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await ReviewHistory.create({
      question_id: question.id,
      action: 'approve',
      reviewer_id: req.user?.id || null,
      reviewer_name: reviewerName || req.user?.full_name || 'Anonymous',
      previous_answer: question.original_answer_key,
      new_answer: question.original_answer_key,
      previous_explanation: question.original_explanation,
      new_explanation: question.original_explanation,
      reason,
    });

    await question.update({
      approved_answer_key: question.verified_answer_key || question.original_answer_key,
      approved_explanation: question.suggested_explanation || question.original_explanation,
      review_status: 'approved',
      needs_human_review: false,
    });

    res.json({ success: true, message: 'Suggestion approved', data: question });
  } catch (err) {
    next(err);
  }
};

exports.rejectSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, reason } = req.body;

    const question = await Question.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await ReviewHistory.create({
      question_id: question.id,
      action: 'reject',
      reviewer_id: req.user?.id || null,
      reviewer_name: reviewerName || req.user?.full_name || 'Anonymous',
      previous_answer: question.verified_answer_key,
      new_answer: question.original_answer_key,
      previous_explanation: question.suggested_explanation,
      new_explanation: question.original_explanation,
      reason,
    });

    await question.update({
      approved_answer_key: question.original_answer_key,
      approved_explanation: question.original_explanation,
      review_status: 'rejected',
      needs_human_review: false,
    });

    res.json({ success: true, message: 'Suggestion rejected', data: question });
  } catch (err) {
    next(err);
  }
};

exports.editSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, approvedAnswerKey, approvedExplanation, reason } = req.body;

    const question = await Question.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await ReviewHistory.create({
      question_id: question.id,
      action: 'edit',
      reviewer_id: req.user?.id || null,
      reviewer_name: reviewerName || req.user?.full_name || 'Anonymous',
      previous_answer: question.approved_answer_key || question.original_answer_key,
      new_answer: approvedAnswerKey,
      previous_explanation: question.approved_explanation || question.original_explanation,
      new_explanation: approvedExplanation,
      reason,
    });

    await question.update({
      approved_answer_key: approvedAnswerKey,
      approved_explanation: approvedExplanation,
      review_status: 'edited',
      needs_human_review: false,
    });

    res.json({ success: true, message: 'Suggestion edited', data: question });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, comment } = req.body;

    const question = await Question.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await ReviewHistory.create({
      question_id: question.id,
      action: 'comment',
      reviewer_id: req.user?.id || null,
      reviewer_name: reviewerName || req.user?.full_name || 'Anonymous',
      reason: comment,
    });

    res.json({ success: true, message: 'Comment added', data: question });
  } catch (err) {
    next(err);
  }
};

exports.getReviewHistory = async (req, res, next) => {
  try {
    const history = await ReviewHistory.findAll({
      where: { question_id: req.params.id },
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};
