const logger = require('../config/logger');

class QuestionParser {
  static parseQuestions(text, pageNumber = 1, options = {}) {
    const questions = [];
    const warnings = [];
    const { subject, chapter, examYear, examType, sourcePdf, extractionMethod } = options;

    if (!text || text.trim().length === 0) {
      return { questions: [], warnings: ['No text content to parse'] };
    }

    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\f/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {3,}/g, '  ');

    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const questionBlocks = this.extractQuestionBlocks(lines, warnings);

    for (const block of questionBlocks) {
      const parsed = this.parseQuestionBlock(block, pageNumber);
      if (parsed) {
        parsed.metadata = {
          subject,
          chapter,
          exam_year: examYear,
          exam_type: examType,
          source_pdf: sourcePdf,
          extraction_method: extractionMethod || 'text',
        };
        parsed.page_number = pageNumber;
        parsed.warnings = parsed.warnings || [];
        questions.push(parsed);
      }
    }

    if (questionBlocks.length === 0) {
      warnings.push('No question boundaries detected');
    }

    return { questions, warnings };
  }

  static extractQuestionBlocks(lines, warnings) {
    const blocks = [];
    let currentBlock = [];
    let inQuestion = false;

    const questionNumRegex = /^\s*(\d+)([\.\)]\s*|\s+[ABCD]\s*)\s*(.*)/;
    const mcqStartRegex = /^Q\s*\.?\s*\d+/i;
    const numberedItemRegex = /^([A-D])\)\s*/;
    const optionsRegex = /^\(?(A|B|C|D)\)?[\.\)]\s*/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isQuestionStart = questionNumRegex.test(line) || mcqStartRegex.test(line);

      if (isQuestionStart && currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [line];
      } else if (isQuestionStart && currentBlock.length === 0) {
        currentBlock = [line];
        inQuestion = true;
      } else if (currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  static parseQuestionBlock(block, pageNumber) {
    if (block.length === 0) return null;

    const fullText = block.join('\n');
    const firstLine = block[0];

    const numMatch = firstLine.match(/(\d+)\s*[\.\)]\s*(.*)/);
    const qNumMatch = firstLine.match(/Q\s*\.?\s*(\d+)\s*[:\.]?\s*(.*)/i);
    const inlineAnsMatch = firstLine.match(/^(\d+)?\s*[\.\)]?\s*\(?([a-d])\)?\s*[:\.]?\s*(.*)/i);

    const questionNumber = (numMatch ? numMatch[1] : null) || (qNumMatch ? qNumMatch[1] : null) || (inlineAnsMatch ? inlineAnsMatch[1] : null);
    let firstLineText = (numMatch ? numMatch[2] : null) || (qNumMatch ? qNumMatch[2] : firstLine);

    if (!questionNumber) return null;

    let answerKey = null;
    if (inlineAnsMatch && inlineAnsMatch[2]) {
      answerKey = inlineAnsMatch[2].toUpperCase();
      firstLineText = inlineAnsMatch[3] || '';
    }

    const question = {
      question_number: questionNumber,
      page_number: pageNumber,
      question_text: '',
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      original_answer_key: answerKey,
      original_explanation: null,
      warnings: [],
      is_uncertain: false,
    };

    const lines = block.slice(1);
    let questionText = firstLineText || '';
    let explanation = answerKey ? (firstLineText ? firstLineText + '\n' : '') : '';
    let inExplanation = !!answerKey;
    let inOptions = !answerKey;

    const optionRegex = /^([A-D])\)?\s*/i;
    const answerRegex = /(?:answer|ans|key|solution)\s*[:\.]?\s*([A-D])/i;
    const explanationRegex = /(?:explanation|reason|explain)\s*[:\.]?\s*/i;
    const solRegex = /(?:solution|sol\.?)\s*[:\.]?\s*/i;

    for (const line of lines) {
      const optMatch = line.match(optionRegex);
      const ansMatch = line.match(answerRegex);
      const expMatch = line.match(explanationRegex) || line.match(solRegex);

      if (optMatch && inOptions) {
        const optLetter = optMatch[1].toUpperCase();
        const optText = line.replace(optMatch[0], '').trim();
        question[`option_${optLetter.toLowerCase()}`] = optText;
      } else if (ansMatch) {
        answerKey = ansMatch[1].toUpperCase();
        inOptions = false;
        inExplanation = true;
      } else if (expMatch) {
        inExplanation = true;
        explanation += line.replace(expMatch[0], '').trim() + '\n';
      } else if (inExplanation) {
        if (answerKey) {
          explanation += line.trim() + '\n';
        } else {
          explanation += line.trim() + '\n';
        }
      } else if (inOptions && !optMatch) {
        questionText += ' ' + line.trim();
      }
    }

    question.question_text = questionText.trim() || fullText;
    question.original_answer_key = answerKey;
    question.original_explanation = explanation.trim() || null;

    const hasOptions = ['a', 'b', 'c', 'd'].some(opt => question[`option_${opt}`]);
    if (!hasOptions) {
      question.warnings.push('No options (A-D) detected');
      question.is_uncertain = true;
    }

    if (!answerKey) {
      question.warnings.push('No answer key found');
      question.is_uncertain = true;
    }

    if (!question.question_text) {
      question.warnings.push('Question text may be incomplete');
      question.is_uncertain = true;
    }

    if (question.warnings.length > 0) {
      logger.warn(`Question ${questionNumber} on page ${pageNumber} has warnings: ${question.warnings.join(', ')}`);
    }

    return question;
  }

  static mergeMultiPageText(pageTexts) {
    return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
  }
}

module.exports = QuestionParser;
