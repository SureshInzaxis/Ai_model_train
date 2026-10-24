const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { sequelize } = require('../config/database');

async function resetUploadedWork() {
  await sequelize.authenticate();
  const run = (sql) => sequelize.query(sql);

  const countSql = `
    SELECT
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(*) FROM questions WHERE stable_id LIKE 'IL-%') AS ilearn_questions,
      (SELECT COUNT(*) FROM pdf_documents) AS pdfs
  `;
  const [beforeRows] = await run(countSql);
  const before = beforeRows[0];

  console.log('Before:', before);

  await run('DELETE FROM verification_results WHERE question_id IN (SELECT id FROM questions WHERE stable_id NOT LIKE \'IL-%\')');
  await run('DELETE FROM review_history WHERE question_id IN (SELECT id FROM questions WHERE stable_id NOT LIKE \'IL-%\')');
  try {
    await run('DELETE FROM corrected_questions');
  } catch (err) {
    console.warn('corrected_questions skip:', err.message);
  }
  await run('DELETE FROM processing_jobs');
  await run('DELETE FROM questions WHERE stable_id NOT LIKE \'IL-%\'');
  await run('DELETE FROM pdf_documents');

  const uploadsDir = path.resolve(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    for (const name of fs.readdirSync(uploadsDir)) {
      const full = path.join(uploadsDir, name);
      fs.rmSync(full, { recursive: true, force: true });
    }
    console.log('Cleared uploads folder:', uploadsDir);
  }

  const [afterRows] = await run(countSql);

  const after = afterRows[0];
  console.log('After:', after);
  await sequelize.close();
}

resetUploadedWork().catch((err) => {
  console.error(err);
  process.exit(1);
});
