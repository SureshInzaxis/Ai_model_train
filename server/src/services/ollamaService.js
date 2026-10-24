const ollama = require('../config/ollama');
const logger = require('../config/logger');
const { collectDiagramImages } = require('../utils/diagramUtils');

const ISSUE_TYPES = [
  'correct',
  'possible_key_error',
  'incorrect_explanation',
  'ambiguous_question',
  'missing_info',
  'extraction_error',
  'needs_review',
];

const PAIR_ISSUE_TYPES = [
  'correct',
  'wrong_answer',
  'wrong_explanation',
  'wrong_question',
  'wrong_options',
  'answer_conflict',
  'needs_review',
];

class OllamaVerificationService {
  buildPrompt(question) {
    const prompt = `
You are an expert exam answer key verifier. Your task is to independently solve each question and compare your answer with the provided answer key.

Question Number: ${question.question_number || 'N/A'}
Question Text:
${question.question_text || 'No question text available'}

Options:
A: ${question.option_a || 'N/A'}
B: ${question.option_b || 'N/A'}
C: ${question.option_c || 'N/A'}
D: ${question.option_d || 'N/A'}

Provided Answer Key: ${question.original_answer_key || 'Not provided'}
Provided Explanation: ${question.original_explanation || 'Not provided'}

Subject: ${question.metadata?.subject || 'General'}
Chapter: ${question.metadata?.chapter || 'General'}

Instructions:
1. Solve the question independently using your own knowledge.
2. Compare your answer with the provided answer key.
3. Identify any issues such as: incorrect answer key, incorrect explanation, ambiguous question, missing information, or extraction/OCR problems.
4. Provide a confidence rating from 0 to 100 (how confident you are in your suggested answer).
5. Provide a complete step-by-step suggestedExplanation even if none was given. Never leave it empty.
6. If the question includes a diagram/image, use it in your reasoning.

Respond in valid JSON format only, with no additional text:
{
  "suggestedAnswer": "A|B|C|D|E|F|G|H",
  "answerMatches": true|false,
  "issueType": "correct|possible_key_error|incorrect_explanation|ambiguous_question|missing_info|extraction_error|needs_review",
  "confidence": 0-100,
  "reason": "Brief explanation of why the answer matches or differs",
  "suggestedExplanation": "Concise explanation of how to solve this question",
  "needsHumanReview": true|false,
  "mathematicalVerification": "Any symbolic math check if applicable, or null"
}
`;
    return prompt;
  }

  async verifyQuestion(question) {
    const maxRetries = parseInt(process.env.OLLAMA_MAX_RETRIES || '2', 10);
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildPrompt(question);
        const result = await ollama.generateWithFormat(prompt);

        let parsed;
        try {
          if (typeof result.response === 'string') {
            parsed = JSON.parse(result.response);
          } else {
            parsed = result;
          }
        } catch (parseError) {
          logger.warn(`JSON parse failed on attempt ${attempt + 1}, trying repair`);
          const repaired = this.repairJson(result.response);
          if (repaired) {
            parsed = repaired;
          } else {
            throw new Error(`Invalid JSON from model: ${parseError.message}`);
          }
        }

        const validated = this.validateResponse(parsed);

        return {
          model_used: ollama.model,
          suggested_answer: validated.suggestedAnswer,
          answer_matches: validated.answerMatches,
          issue_type: validated.issueType,
          confidence: validated.confidence,
          reason: validated.reason,
          suggested_explanation: validated.suggestedExplanation,
          needs_human_review: validated.needsHumanReview,
          raw_response: typeof result.response === 'string' ? result.response : JSON.stringify(result),
          eval_count: result.eval_count,
          eval_duration_ms: result.eval_duration,
          prompt_used: prompt.substring(0, 1000),
        };
      } catch (error) {
        lastError = error;
        logger.warn(`Verification attempt ${attempt + 1} failed: ${error.message}`);
        if (attempt < maxRetries) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  validateResponse(data) {
    const validated = {
      suggestedAnswer: data.suggestedAnswer || data.suggested_answer || 'F',
      answerMatches: Boolean(data.answerMatches || data.answer_matches),
      issueType: ISSUE_TYPES.includes(data.issueType || data.issue_type)
        ? (data.issueType || data.issue_type)
        : 'needs_review',
      confidence: Math.min(100, Math.max(0, parseInt(data.confidence || 0, 10))),
      reason: (data.reason || 'No reason provided').substring(0, 500),
      suggestedExplanation: (data.suggestedExplanation || data.suggested_explanation || 'No explanation provided').substring(0, 2000),
      needsHumanReview: Boolean(data.needsHumanReview || data.needs_human_review),
    };

    return validated;
  }

  repairJson(str) {
    let jsonStr = str.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      try {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        return null;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  buildPairPrompt(pdfQ, dbQ, diagramUrls = []) {
    const diagrams = diagramUrls.length
      ? diagramUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')
      : 'None listed as URLs. If images are attached, analyze those diagrams.';
    const dbExplanation = dbQ.explanation && String(dbQ.explanation).trim()
      ? dbQ.explanation
      : 'MISSING — you must write a full correct explanation';
    const pdfExplanation = pdfQ.explanation && String(pdfQ.explanation).trim()
      ? pdfQ.explanation
      : 'MISSING — you must write a full correct explanation';

    return `
You are an expert exam-question auditor for Physics/Chemistry/Math/Biology MCQs.
The printed PDF is the original paper. The local database copy may have a wrong question, wrong options, wrong answer, missing explanation, or a diagram that must be read.

Subject: ${dbQ.subject || pdfQ.subject || 'Unknown'}
Chapter: ${dbQ.chapter || pdfQ.chapter || 'Unknown'}

Question text may contain LaTeX. Keep valid LaTeX in correctedQuestionText and options.

DIAGRAMS (analyze these; they may be required to solve the question):
${diagrams}

DATABASE QUESTION (possibly wrong):
Question: ${dbQ.questionText || 'N/A'}
A: ${dbQ.optionA || 'N/A'}
B: ${dbQ.optionB || 'N/A'}
C: ${dbQ.optionC || 'N/A'}
D: ${dbQ.optionD || 'N/A'}
Database answer key: ${dbQ.answerKey || 'N/A'}
Database explanation: ${dbExplanation}

PDF QUESTION (printed paper):
Question: ${pdfQ.questionText || 'N/A'}
A: ${pdfQ.optionA || 'N/A'}
B: ${pdfQ.optionB || 'N/A'}
C: ${pdfQ.optionC || 'N/A'}
D: ${pdfQ.optionD || 'N/A'}
PDF answer key: ${pdfQ.answerKey || 'N/A'}
PDF explanation: ${pdfExplanation}

Instructions:
1. If a diagram is attached or linked, describe what it shows and use it to solve the question.
2. Solve the MCQ independently. You MUST always choose correctedAnswer as A, B, C, or D.
3. You MUST always write a complete correctedExplanation (step-by-step, including diagram reasoning if any). Never leave it empty, even if the database/PDF explanation is missing.
4. Prefer the printed PDF when the two disagree, unless PDF extraction is garbled.
5. Pick one issueType:
   - correct: database question, options, and answer are right (you may still add a missing explanation)
   - wrong_answer: database answer key is wrong
   - wrong_explanation: database explanation is wrong or missing
   - wrong_question: database question text is wrong
   - wrong_options: database options are wrong
   - answer_conflict: PDF and database answers differ and you are unsure
   - needs_review: you cannot decide

Respond in valid JSON only:
{
  "issueType": "correct|wrong_answer|wrong_explanation|wrong_question|wrong_options|answer_conflict|needs_review",
  "diagramAnalysis": "what the diagram shows, or null",
  "correctedQuestionText": "final question text, keep LaTeX",
  "correctedOptionA": "A text or null",
  "correctedOptionB": "B text or null",
  "correctedOptionC": "C text or null",
  "correctedOptionD": "D text or null",
  "correctedAnswer": "A|B|C|D",
  "correctedExplanation": "full step-by-step explanation, required",
  "confidence": 0-100,
  "reason": "short reason",
  "needsHumanReview": true|false
}
`;
  }

  async compareAndCorrect(pdfQ, dbQ) {
    const maxRetries = parseInt(process.env.OLLAMA_MAX_RETRIES || '2', 10);
    let lastError = null;
    const safeDb = dbQ || {
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      answerKey: '',
      explanation: '',
      subject: pdfQ.subject,
      chapter: pdfQ.chapter,
    };

    const { urls, images } = await collectDiagramImages(
      pdfQ.questionText, pdfQ.optionA, pdfQ.optionB, pdfQ.optionC, pdfQ.optionD, pdfQ.explanation,
      safeDb.questionText, safeDb.optionA, safeDb.optionB, safeDb.optionC, safeDb.optionD, safeDb.explanation
    );
    const prompt = this.buildPairPrompt(pdfQ, safeDb, urls);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let result;
        try {
          if (images.length) {
            result = await ollama.chat({ prompt, images, format: 'json' });
          } else {
            result = await ollama.generateWithFormat(prompt);
          }
        } catch (visionErr) {
          logger.warn(`Vision/chat path failed, using text generate: ${visionErr.message}`);
          result = await ollama.generateWithFormat(prompt);
        }

        let parsed;
        try {
          parsed = typeof result.response === 'string'
            ? JSON.parse(result.response)
            : result;
        } catch {
          parsed = this.repairJson(result.response);
          if (!parsed) throw new Error('Invalid JSON from model');
        }

        const issueType = PAIR_ISSUE_TYPES.includes(parsed.issueType || parsed.issue_type)
          ? (parsed.issueType || parsed.issue_type)
          : 'needs_review';

        const explanation = String(
          parsed.correctedExplanation || parsed.corrected_explanation || ''
        ).trim();
        const answer = String(parsed.correctedAnswer || parsed.corrected_answer || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-D]/g, '')
          .slice(0, 1);

        if (!answer) {
          throw new Error('Model did not return a corrected A-D answer');
        }
        if (explanation.length < 12) {
          throw new Error('Model did not return a usable explanation');
        }

        const diagramNote = parsed.diagramAnalysis || parsed.diagram_analysis;
        const reason = [
          diagramNote ? `Diagram: ${diagramNote}` : null,
          parsed.reason || 'No reason provided',
        ].filter(Boolean).join(' | ');

        const hadNoExplanation = !String(safeDb.explanation || pdfQ.explanation || '').trim();
        const finalIssue = (!hadNoExplanation || issueType !== 'correct')
          ? issueType
          : 'wrong_explanation';

        return {
          issue_type: finalIssue,
          question_text: parsed.correctedQuestionText || parsed.corrected_question_text || pdfQ.questionText || safeDb.questionText,
          option_a: parsed.correctedOptionA || parsed.corrected_option_a || pdfQ.optionA || safeDb.optionA || null,
          option_b: parsed.correctedOptionB || parsed.corrected_option_b || pdfQ.optionB || safeDb.optionB || null,
          option_c: parsed.correctedOptionC || parsed.corrected_option_c || pdfQ.optionC || safeDb.optionC || null,
          option_d: parsed.correctedOptionD || parsed.corrected_option_d || pdfQ.optionD || safeDb.optionD || null,
          answer_key: answer,
          explanation,
          ai_confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence || 0, 10))),
          ai_reason: reason.slice(0, 1500),
          needs_human_review: Boolean(
            parsed.needsHumanReview
            || parsed.needs_human_review
            || finalIssue !== 'correct'
            || hadNoExplanation
          ),
          model_used: ollama.model,
        };
      } catch (error) {
        lastError = error;
        logger.warn(`Pair verification attempt ${attempt + 1} failed: ${error.message}`);
        if (attempt < maxRetries) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  async batchVerify(questions, concurrency = 1) {
    const results = [];
    const batchSize = parseInt(process.env.JOB_BATCH_SIZE || '10', 10);

    for (let i = 0; i < questions.length; i += concurrency) {
      const batch = questions.slice(i, i + concurrency);
      const promises = batch.map(async (q) => {
        try {
          const result = await this.verifyQuestion(q);
          return { questionId: q.id, success: true, data: result };
        } catch (error) {
          return {
            questionId: q.id,
            success: false,
            error: error.message,
          };
        }
      });
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }
}

module.exports = new OllamaVerificationService();
