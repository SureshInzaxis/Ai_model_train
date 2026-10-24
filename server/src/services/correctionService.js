const { Question, CorrectedQuestion, PDFDocument, Subject, Chapter } = require('../models');
const { Op } = require('sequelize');
const ComparisonService = require('./comparisonService');
const ollamaVerification = require('./ollamaService');
const logger = require('../config/logger');

const preferText = (...values) => {
  for (const value of values) {
    if (value && String(value).trim()) return value;
  }
  return null;
};

const normalizeAnswer = (value) => {
  if (!value || value === 'N/A') return null;
  return String(value).trim().toUpperCase().slice(0, 10);
};

class CorrectionService {
  static async analyzePdf(pdfDocumentId) {
    const comparison = await ComparisonService.comparePdfDocument(pdfDocumentId);
    const saved = [];

    for (const item of comparison.comparisons) {
      const row = await this.upsertFromComparison(pdfDocumentId, item);
      saved.push(row);

      if (item.matchedQuestion && item.pdfQuestion?.id) {
        const patch = {};
        if (item.matchedQuestion.subjectId) patch.subject_id = item.matchedQuestion.subjectId;
        if (item.matchedQuestion.chapterId) patch.chapter_id = item.matchedQuestion.chapterId;
        if (Object.keys(patch).length) {
          await Question.update(patch, { where: { id: item.pdfQuestion.id } }).catch(() => {});
        }
      }
    }

    comparison.correctedIds = saved.filter(Boolean).map((row) => row.id);
    comparison.summary.storedDrafts = saved.length;
    return comparison;
  }

  static buildCorrectedPayload(pdfDocumentId, item) {
    const pdfQ = item.pdfQuestion || {};
    const dbQ = item.matchedQuestion;
    const matchStatus = item.status === 'conflict'
      ? 'conflict'
      : (item.status === 'duplicate' || item.status === 'matched')
        ? 'matched'
        : 'unmatched';

    const questionText = preferText(dbQ?.questionText, pdfQ.questionText) || 'Untitled question';
    const optionA = preferText(dbQ?.optionA, pdfQ.optionA);
    const optionB = preferText(dbQ?.optionB, pdfQ.optionB);
    const optionC = preferText(dbQ?.optionC, pdfQ.optionC);
    const optionD = preferText(dbQ?.optionD, pdfQ.optionD);
    const pdfAnswer = normalizeAnswer(pdfQ.answerKey);
    const dbAnswer = normalizeAnswer(dbQ?.answerKey);
    const answerKey = pdfAnswer || dbAnswer;
    const explanation = preferText(pdfQ.explanation, dbQ?.explanation);

    let issueType = null;
    if (matchStatus === 'conflict') issueType = 'answer_conflict';
    else if (matchStatus === 'unmatched') issueType = 'needs_review';

    return {
      source_question_id: dbQ?.id || null,
      extracted_question_id: pdfQ.id || null,
      pdf_document_id: pdfDocumentId,
      question_number: pdfQ.questionNumber || dbQ?.questionNumber || null,
      subject_id: dbQ?.subjectId || null,
      chapter_id: dbQ?.chapterId || null,
      subject_name: dbQ?.subject || pdfQ.subject || null,
      chapter_name: dbQ?.chapter || pdfQ.chapter || null,
      exam_year: dbQ?.examYear || null,
      exam_type: dbQ?.examType || null,
      db_question_text: dbQ?.questionText || null,
      db_option_a: dbQ?.optionA || null,
      db_option_b: dbQ?.optionB || null,
      db_option_c: dbQ?.optionC || null,
      db_option_d: dbQ?.optionD || null,
      db_answer_key: dbAnswer,
      db_explanation: dbQ?.explanation || null,
      pdf_question_text: pdfQ.questionText || null,
      pdf_option_a: pdfQ.optionA || null,
      pdf_option_b: pdfQ.optionB || null,
      pdf_option_c: pdfQ.optionC || null,
      pdf_option_d: pdfQ.optionD || null,
      pdf_answer_key: pdfAnswer,
      pdf_explanation: pdfQ.explanation || null,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      options_json: { A: optionA, B: optionB, C: optionC, D: optionD },
      answer_key: answerKey,
      explanation,
      match_status: matchStatus,
      match_similarity: item.similarity || 0,
      issue_type: issueType,
      needs_human_review: matchStatus !== 'matched' || !answerKey,
    };
  }

  static async upsertFromComparison(pdfDocumentId, item) {
    const payload = this.buildCorrectedPayload(pdfDocumentId, item);
    const where = payload.extracted_question_id
      ? { pdf_document_id: pdfDocumentId, extracted_question_id: payload.extracted_question_id }
      : { pdf_document_id: pdfDocumentId, question_number: payload.question_number };

    const existing = await CorrectedQuestion.findOne({ where });
    if (existing) {
      if (existing.ai_verified || existing.review_status === 'approved') {
        return existing;
      }
      await existing.update(payload);
      return existing;
    }
    return CorrectedQuestion.create(payload);
  }

  static async verifyOne(id) {
    const [claimed] = await CorrectedQuestion.update(
      { ai_status: 'running' },
      { where: { id, ai_status: { [Op.in]: ['pending', 'failed'] } } }
    );
    if (!claimed) return null;

    const row = await CorrectedQuestion.findByPk(id);
    if (!row) return null;

    const pdfQ = {
      questionText: row.pdf_question_text,
      optionA: row.pdf_option_a,
      optionB: row.pdf_option_b,
      optionC: row.pdf_option_c,
      optionD: row.pdf_option_d,
      answerKey: row.pdf_answer_key,
      explanation: row.pdf_explanation,
      subject: row.subject_name,
      chapter: row.chapter_name,
    };
    const dbQ = row.source_question_id
      ? {
          questionText: row.db_question_text,
          optionA: row.db_option_a,
          optionB: row.db_option_b,
          optionC: row.db_option_c,
          optionD: row.db_option_d,
          answerKey: row.db_answer_key,
          explanation: row.db_explanation,
          subject: row.subject_name,
          chapter: row.chapter_name,
        }
      : null;

    try {
      const result = await ollamaVerification.compareAndCorrect(pdfQ, dbQ);
      await row.update({
        question_text: result.question_text || row.question_text,
        option_a: result.option_a,
        option_b: result.option_b,
        option_c: result.option_c,
        option_d: result.option_d,
        options_json: {
          A: result.option_a,
          B: result.option_b,
          C: result.option_c,
          D: result.option_d,
        },
        answer_key: result.answer_key,
        explanation: result.explanation,
        issue_type: result.issue_type,
        ai_confidence: result.ai_confidence,
        ai_reason: result.ai_reason,
        needs_human_review: result.needs_human_review,
        ai_verified: true,
        ai_status: 'done',
      });
      logger.info(`AI correction finished for corrected_questions#${row.id} (${result.issue_type})`);
      return row;
    } catch (error) {
      await row.update({
        ai_status: 'failed',
        ai_reason: error.message,
      });
      logger.error(`AI correction failed for corrected_questions#${id}: ${error.message}`);
      throw error;
    }
  }

  static async verifyMany(ids) {
    const results = { done: 0, failed: 0 };
    for (const id of ids) {
      try {
        await this.verifyOne(id);
        results.done++;
      } catch {
        results.failed++;
      }
    }
    return results;
  }

  static async verifyPdfInBackground(pdfDocumentId) {
    let rows = await CorrectedQuestion.findAll({
      where: {
        pdf_document_id: pdfDocumentId,
        ai_status: { [Op.in]: ['pending', 'failed'] },
      },
      attributes: ['id'],
    });

    if (!rows.length) {
      await CorrectedQuestion.update(
        { ai_status: 'pending', ai_verified: false },
        {
          where: {
            pdf_document_id: pdfDocumentId,
            ai_status: { [Op.ne]: 'running' },
          },
        }
      );
      rows = await CorrectedQuestion.findAll({
        where: { pdf_document_id: pdfDocumentId, ai_status: 'pending' },
        attributes: ['id'],
      });
    }

    const ids = rows.map((row) => row.id);
    if (!ids.length) return { queued: 0 };

    try {
      const queueManager = require('../jobs/queueManager');
      await queueManager.addVerificationJob({ type: 'correction', correctedIds: ids });
      logger.info(`Queued Qwen verification for ${ids.length} corrected questions (PDF ${pdfDocumentId})`);
    } catch (error) {
      logger.warn(`Verification queue unavailable, running in-process: ${error.message}`);
    }

    setImmediate(() => {
      this.verifyMany(ids).catch((err) => {
        logger.error(`In-process PDF verification failed: ${err.message}`);
      });
    });

    return { queued: ids.length };
  }

  static async storePdf(pdfDocumentId, { approveClean = true } = {}) {
    const where = { pdf_document_id: pdfDocumentId };
    const rows = await CorrectedQuestion.findAll({ where });
    const now = new Date();
    let stored = 0;

    for (const row of rows) {
      const updates = { stored_at: now };
      if (approveClean && row.issue_type === 'correct' && !row.needs_human_review) {
        updates.review_status = 'approved';
      }
      await row.update(updates);
      stored++;
    }

    return { stored, total: rows.length };
  }

  static toComparisonShape(row) {
    const matched = row.source_question_id
      ? {
          id: row.source_question_id,
          questionNumber: row.question_number,
          questionText: row.db_question_text,
          optionA: row.db_option_a,
          optionB: row.db_option_b,
          optionC: row.db_option_c,
          optionD: row.db_option_d,
          answerKey: row.db_answer_key || 'N/A',
          explanation: row.db_explanation,
          subject: row.subject_name,
          chapter: row.chapter_name,
        }
      : null;

    return {
      correctedId: row.id,
      status: row.match_status === 'unmatched' ? 'new' : row.match_status,
      similarity: row.match_similarity,
      issue: row.ai_reason || (
        row.match_status === 'conflict'
          ? `Answer mismatch: database has (${row.db_answer_key}) but PDF has (${row.pdf_answer_key})`
          : null
      ),
      issueType: row.issue_type,
      aiStatus: row.ai_status,
      aiConfidence: row.ai_confidence,
      reviewStatus: row.review_status,
      storedAt: row.stored_at,
      corrected: {
        questionText: row.question_text,
        optionA: row.option_a,
        optionB: row.option_b,
        optionC: row.option_c,
        optionD: row.option_d,
        answerKey: row.answer_key,
        explanation: row.explanation,
        subject: row.subject_name,
        chapter: row.chapter_name,
      },
      pdfQuestion: {
        id: row.extracted_question_id,
        questionNumber: row.question_number,
        questionText: row.pdf_question_text,
        optionA: row.pdf_option_a,
        optionB: row.pdf_option_b,
        optionC: row.pdf_option_c,
        optionD: row.pdf_option_d,
        answerKey: row.pdf_answer_key || 'N/A',
        explanation: row.pdf_explanation,
        subject: row.subject_name || 'Unknown',
        chapter: row.chapter_name || 'Unknown',
      },
      matchedQuestion: matched,
    };
  }

  static async getPdfAnalysis(pdfDocumentId) {
    const pdf = await PDFDocument.findByPk(pdfDocumentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Chapter, as: 'chapter' },
      ],
    });
    const rows = await CorrectedQuestion.findAll({
      where: { pdf_document_id: pdfDocumentId },
      order: [['id', 'ASC']],
    });

    const extractedCount = await Question.count({ where: { pdf_document_id: pdfDocumentId } });
    if (!rows.length || rows.length < extractedCount) {
      return this.analyzePdf(pdfDocumentId);
    }

    const comparisons = rows.map((row) => this.toComparisonShape(row));
    const summary = {
      new: rows.filter((r) => r.match_status === 'unmatched').length,
      duplicates: rows.filter((r) => r.match_status === 'matched').length,
      matched: rows.filter((r) => r.match_status === 'matched').length,
      unmatched: rows.filter((r) => r.match_status === 'unmatched').length,
      conflicts: rows.filter((r) => r.match_status === 'conflict').length,
      aiDone: rows.filter((r) => r.ai_status === 'done').length,
      stored: rows.filter((r) => r.stored_at).length,
    };

    return {
      pdfDocumentId,
      filename: pdf?.filename,
      totalQuestions: rows.length,
      summary,
      comparisons,
    };
  }
}

module.exports = CorrectionService;
