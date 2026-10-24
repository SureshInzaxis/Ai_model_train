const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function importQuestions() {
  const password = process.env.DB_PASSWORD || 'ilearn123';
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'postgres';

  const sourceClient = new Client({
    host,
    port,
    user,
    password,
    database: 'ilearn',
  });

  const targetClient = new Client({
    host,
    port,
    user,
    password,
    database: 'question_analyzer',
  });

  console.log('Connecting to databases...');
  await sourceClient.connect();
  await targetClient.connect();
  console.log('Connected to both databases.');

  const targetSubjectsRes = await targetClient.query('SELECT id, name FROM subjects');
  const targetSubjectMap = {};
  targetSubjectsRes.rows.forEach(r => {
    targetSubjectMap[r.name.toLowerCase()] = r.id;
  });
  console.log('Target subjects mapped:', targetSubjectMap);

  console.log('Fetching questions from ilearn.question_versions...');
  const query = `
    SELECT 
      qv.question_id,
      qv.version_no,
      qv.snapshot,
      s.name as subject_name
    FROM question_versions qv
    LEFT JOIN subjects s ON (qv.snapshot->>'subjectId')::int = s.id
    ORDER BY qv.question_id ASC
  `;

  const { rows } = await sourceClient.query(query);
  console.log('Retrieved ' + rows.length + ' questions from ilearn.');

  const batchSize = 1000;
  let inserted = 0;
  const now = new Date();

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const valuePlaceholders = [];
    const values = [];
    let pIdx = 1;

    for (const r of chunk) {
      const snap = r.snapshot || {};
      const subjectName = (r.subject_name || '').toLowerCase();
      const targetSubjectId = targetSubjectMap[subjectName] || 1;
      const chapterId = snap.chapterId ? parseInt(snap.chapterId, 10) : null;
      
      const qText = snap.question || '';
      const opts = Array.isArray(snap.options) ? snap.options : [];
      const optA = opts[0] !== undefined ? String(opts[0]) : null;
      const optB = opts[1] !== undefined ? String(opts[1]) : null;
      const optC = opts[2] !== undefined ? String(opts[2]) : null;
      const optD = opts[3] !== undefined ? String(opts[3]) : null;
      const optionsJson = JSON.stringify({ A: optA, B: optB, C: optC, D: optD });

      let correctKey = null;
      const correctAns = snap.correctAnswer ? String(snap.correctAnswer).trim() : '';
      if (correctAns) {
        if (opts[0] && String(opts[0]).trim() === correctAns) correctKey = 'A';
        else if (opts[1] && String(opts[1]).trim() === correctAns) correctKey = 'B';
        else if (opts[2] && String(opts[2]).trim() === correctAns) correctKey = 'C';
        else if (opts[3] && String(opts[3]).trim() === correctAns) correctKey = 'D';
        else if (['A', 'B', 'C', 'D'].includes(correctAns.toUpperCase())) correctKey = correctAns.toUpperCase();
        else correctKey = correctAns.substring(0, 10);
      }

      const stableId = 'IL-' + r.question_id;
      const questionNumber = String(r.question_id);
      const explanation = snap.explanation || null;
      const difficulty = snap.difficulty || null;

      values.push(
        stableId,
        targetSubjectId,
        questionNumber,
        qText,
        optA,
        optB,
        optC,
        optD,
        optionsJson,
        correctKey,
        explanation,
        correctKey,
        explanation,
        'approved',
        false,
        'text',
        JSON.stringify({ difficulty, source: 'ilearn_migration', ilearn_q_id: r.question_id }),
        now,
        now,
        chapterId
      );

      const placeholders = [];
      for (let k = 0; k < 20; k++) {
        placeholders.push('$' + (pIdx++));
      }
      valuePlaceholders.push('(' + placeholders.join(', ') + ')');
    }

    const insertSql = `
      INSERT INTO questions (
        stable_id,
        subject_id,
        question_number,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        options_json,
        original_answer_key,
        original_explanation,
        verified_answer_key,
        suggested_explanation,
        review_status,
        needs_human_review,
        extraction_method,
        metadata,
        created_at,
        updated_at,
        ilearn_chapter_id
      ) VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (stable_id) DO NOTHING
    `;

    await targetClient.query(insertSql, values);
    inserted += chunk.length;
    if (inserted % 5000 === 0 || inserted === rows.length) {
      console.log('Imported ' + inserted + ' / ' + rows.length + ' questions...');
    }
  }

  console.log('Import complete! Total processed: ' + inserted);
  await sourceClient.end();
  await targetClient.end();
}

importQuestions().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
