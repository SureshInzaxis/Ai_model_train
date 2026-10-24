const { Question, Subject, Chapter, sequelize } = require('../models');
const { Op } = require('sequelize');
const { isTrigramReady } = require('./searchIndex');
const chapterLookup = require('./chapterLookupService');

const BANK_WHERE = { pdf_document_id: { [Op.is]: null } };

class ComparisonService {
  static normalizeText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[\$\\]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static escapeLike(value) {
    return String(value).replace(/[%_\\]/g, '\\$&');
  }

  static calculateSimilarity(str1, str2) {
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    const words1 = new Set(s1.split(' ').filter((w) => w.length > 2));
    const words2 = new Set(s2.split(' ').filter((w) => w.length > 2));
    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    words1.forEach((w) => {
      if (words2.has(w)) intersection++;
    });
    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  }

  static distinctiveKeywords(text) {
    const stop = new Set([
      'the', 'and', 'for', 'that', 'with', 'this', 'from', 'which', 'then',
      'than', 'what', 'when', 'where', 'have', 'has', 'were', 'been', 'into',
      'find', 'given', 'following', 'correct', 'option', 'options', 'question',
      'figure', 'shown', 'below', 'above', 'equal', 'value', 'each', 'also',
    ]);
    return this.normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 4 && !stop.has(w))
      .slice(0, 8);
  }

  static candidateIncludes() {
    return [
      { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'], required: false },
      { model: Chapter, as: 'chapter', attributes: ['id', 'name', 'code'], required: false },
    ];
  }

  static candidateAttributes() {
    return [
      'id', 'stable_id', 'question_number', 'question_text',
      'option_a', 'option_b', 'option_c', 'option_d', 'options_json',
      'original_answer_key', 'verified_answer_key', 'approved_answer_key',
      'original_explanation', 'approved_explanation', 'suggested_explanation',
      'subject_id', 'chapter_id', 'ilearn_chapter_id', 'exam_year', 'exam_type',
      'pdf_document_id',
    ];
  }

  static async findCandidates(extractedQ, options = {}) {
    const excludeId = options.excludeId || null;
    const text = extractedQ.question_text || '';
    if (!text.trim()) return [];

    const notSelf = excludeId ? { id: { [Op.ne]: excludeId } } : {};

    if (isTrigramReady()) {
      try {
        const [rows] = await sequelize.query(
          `
          SELECT id, similarity(question_text, :text) AS trgm_sim
          FROM questions
          WHERE pdf_document_id IS NULL
            AND (:excludeId::int IS NULL OR id <> :excludeId)
            AND question_text % :text
          ORDER BY trgm_sim DESC
          LIMIT 25
          `,
          { replacements: { text, excludeId } }
        );
        const ids = (rows || []).map((r) => r.id);
        if (ids.length) {
          const found = await Question.findAll({
            where: { id: ids },
            attributes: this.candidateAttributes(),
            include: this.candidateIncludes(),
          });
          const order = new Map(ids.map((id, i) => [id, i]));
          found.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
          return found;
        }
      } catch (error) {
        // fall through to keyword search
      }
    }

    const keywords = this.distinctiveKeywords(text);
    const where = { ...BANK_WHERE, ...notSelf };
    if (keywords.length > 0) {
      where[Op.or] = keywords.map((kw) => ({
        question_text: { [Op.iLike]: `%${this.escapeLike(kw)}%` },
      }));
    } else {
      const snippet = this.normalizeText(text).slice(0, 40);
      if (snippet) {
        where.question_text = { [Op.iLike]: `%${this.escapeLike(snippet)}%` };
      }
    }

    return Question.findAll({
      where,
      limit: 80,
      attributes: this.candidateAttributes(),
      include: this.candidateIncludes(),
    });
  }

  static pickBestMatch(extractedQ, candidates, preferredSubjectId) {
    let bestMatch = null;
    let highestSim = 0;

    for (const candidate of candidates) {
      let sim = this.calculateSimilarity(extractedQ.question_text, candidate.question_text);
      if (preferredSubjectId && candidate.subject_id === preferredSubjectId) {
        sim = Math.min(1, sim + 0.05);
      }
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = candidate;
      }
    }

    return { bestMatch, highestSim };
  }

  static dbAnswer(question) {
    return (
      question.approved_answer_key
      || question.verified_answer_key
      || question.original_answer_key
      || ''
    ).toString().trim().toUpperCase();
  }

  static dbExplanation(question) {
    return question.approved_explanation
      || question.original_explanation
      || question.suggested_explanation
      || null;
  }

  static pdfAnswer(question) {
    return (
      question.approved_answer_key
      || question.verified_answer_key
      || question.original_answer_key
      || ''
    ).toString().trim().toUpperCase();
  }

  static async serializeMatch(bestMatch, highestSim, extractedQ) {
    const subject = await chapterLookup.resolveSubject(bestMatch);
    const chapter = await chapterLookup.resolveChapter(bestMatch);
    const dbAnswer = this.dbAnswer(bestMatch);
    const pdfAnswer = this.pdfAnswer(extractedQ);
    const answerMatch = dbAnswer && pdfAnswer ? dbAnswer === pdfAnswer : null;

    let status = 'matched';
    let issue = `Matched database question (${Math.round(highestSim * 100)}%)`;
    if (answerMatch === false) {
      status = 'conflict';
      issue = `Answer mismatch: database has (${dbAnswer}) but PDF has (${pdfAnswer})`;
    } else if (highestSim >= 0.95) {
      issue = 'Near-exact match in the 50k question bank';
    }

    return {
      status,
      similarity: Math.round(highestSim * 100),
      matchedQuestion: {
        id: bestMatch.id,
        stableId: bestMatch.stable_id,
        questionNumber: bestMatch.question_number,
        questionText: bestMatch.question_text,
        optionA: bestMatch.option_a,
        optionB: bestMatch.option_b,
        optionC: bestMatch.option_c,
        optionD: bestMatch.option_d,
        optionsJson: bestMatch.options_json,
        answerKey: dbAnswer || 'N/A',
        explanation: this.dbExplanation(bestMatch),
        subjectId: subject.id,
        subject: subject.name || 'Unknown',
        subjectCode: subject.code || null,
        chapterId: chapter.id,
        chapter: chapter.name || 'Unknown',
        examYear: bestMatch.exam_year,
        examType: bestMatch.exam_type,
      },
      issue,
    };
  }

  static async compareQuestion(extractedQ, subjectId, options = {}) {
    const candidates = await this.findCandidates(extractedQ, {
      excludeId: extractedQ.id || options.excludeId,
    });
    const { bestMatch, highestSim } = this.pickBestMatch(extractedQ, candidates, subjectId);

    if (bestMatch && highestSim >= 0.55) {
      return this.serializeMatch(bestMatch, highestSim, extractedQ);
    }

    return {
      status: 'unmatched',
      similarity: Math.round(highestSim * 100),
      matchedQuestion: null,
      issue: highestSim > 0
        ? `No confident match (best ${Math.round(highestSim * 100)}%)`
        : 'Question not found in the 50k database',
    };
  }

  static async comparePdfDocument(pdfDocumentId) {
    const questions = await Question.findAll({
      where: { pdf_document_id: pdfDocumentId },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'], required: false },
        { model: Chapter, as: 'chapter', attributes: ['id', 'name', 'code'], required: false },
      ],
      order: [['id', 'ASC']],
    });

    const results = [];
    let matchedCount = 0;
    let conflictCount = 0;
    let unmatchedCount = 0;

    for (const q of questions) {
      const comp = await this.compareQuestion(q, q.subject_id, { excludeId: q.id });
      if (comp.status === 'matched') matchedCount++;
      else if (comp.status === 'conflict') conflictCount++;
      else unmatchedCount++;

      const displaySubject = comp.matchedQuestion?.subject || (q.subject ? q.subject.name : 'Unknown');
      const displayChapter = comp.matchedQuestion?.chapter || (q.chapter ? q.chapter.name : 'Unknown');

      results.push({
        pdfQuestion: {
          id: q.id,
          questionNumber: q.question_number,
          questionText: q.question_text,
          optionA: q.option_a,
          optionB: q.option_b,
          optionC: q.option_c,
          optionD: q.option_d,
          optionsJson: q.options_json,
          answerKey: this.pdfAnswer(q) || 'N/A',
          explanation: q.original_explanation || q.suggested_explanation || null,
          diagramUrl: q.metadata?.diagram_url || null,
          subject: displaySubject,
          chapter: displayChapter,
        },
        status: comp.status === 'unmatched' ? 'new' : comp.status,
        similarity: comp.similarity,
        issue: comp.issue,
        matchedQuestion: comp.matchedQuestion,
      });
    }

    return {
      pdfDocumentId,
      totalQuestions: questions.length,
      summary: {
        new: unmatchedCount,
        duplicates: matchedCount,
        matched: matchedCount,
        unmatched: unmatchedCount,
        conflicts: conflictCount,
      },
      comparisons: results,
    };
  }
}

module.exports = ComparisonService;
