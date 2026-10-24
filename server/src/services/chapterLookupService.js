const { Client } = require('pg');
const { Chapter, Subject } = require('../models');
const logger = require('../config/logger');

const ilearnNameById = new Map();
let loaded = false;

const queryIlearnChapters = async (client) => {
  const attempts = [
    'SELECT id, name FROM chapters',
    'SELECT id, title AS name FROM chapters',
    'SELECT id, name FROM chapter',
    'SELECT id, chapter_name AS name FROM chapters',
  ];

  for (const sql of attempts) {
    try {
      const { rows } = await client.query(sql);
      if (rows && rows.length) return rows;
    } catch {
      // try next shape
    }
  }
  return [];
};

const load = async () => {
  if (loaded) return;

  try {
    const client = new Client({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'ilearn',
    });
    await client.connect();
    const rows = await queryIlearnChapters(client);
    await client.end();
    rows.forEach((row) => {
      if (row.id != null && row.name) {
        ilearnNameById.set(Number(row.id), String(row.name).trim());
      }
    });
    logger.info(`Loaded ${ilearnNameById.size} chapter names from ilearn`);
  } catch (error) {
    logger.warn(`Could not load ilearn chapter names: ${error.message}`);
  }

  loaded = true;
};

const getIlearnChapterName = (ilearnChapterId) => {
  if (ilearnChapterId == null) return null;
  return ilearnNameById.get(Number(ilearnChapterId)) || null;
};

const resolveChapter = async (question) => {
  if (question.chapter && question.chapter.name) {
    return {
      id: question.chapter.id,
      name: question.chapter.name,
    };
  }

  if (question.chapter_id) {
    const local = await Chapter.findByPk(question.chapter_id);
    if (local) return { id: local.id, name: local.name };
  }

  const ilearnId = question.ilearn_chapter_id;
  const ilearnName = getIlearnChapterName(ilearnId);
  if (!ilearnName || !question.subject_id) {
    return ilearnId
      ? { id: null, name: `Chapter #${ilearnId}` }
      : { id: null, name: null };
  }

  const [chapter] = await Chapter.findOrCreate({
    where: { subject_id: question.subject_id, name: ilearnName },
    defaults: {
      subject_id: question.subject_id,
      name: ilearnName,
      code: `IL${ilearnId}`,
      sort_order: Number(ilearnId) || 0,
    },
  });

  if (!question.chapter_id && question.id && typeof question.update === 'function') {
    await question.update({ chapter_id: chapter.id }).catch(() => {});
  }

  return { id: chapter.id, name: chapter.name };
};

const resolveSubject = async (question) => {
  if (question.subject && question.subject.name) {
    return {
      id: question.subject.id,
      name: question.subject.name,
      code: question.subject.code,
    };
  }
  if (!question.subject_id) return { id: null, name: null, code: null };
  const subject = await Subject.findByPk(question.subject_id);
  return subject
    ? { id: subject.id, name: subject.name, code: subject.code }
    : { id: question.subject_id, name: null, code: null };
};

module.exports = {
  load,
  getIlearnChapterName,
  resolveChapter,
  resolveSubject,
};
