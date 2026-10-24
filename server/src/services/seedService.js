const { Subject, Chapter } = require('../models');
const logger = require('../config/logger');

const DEFAULT_SUBJECTS = [
  { name: 'Physics', code: 'PHY', sort_order: 1 },
  { name: 'Chemistry', code: 'CHEM', sort_order: 2 },
  { name: 'Mathematics', code: 'MATH', sort_order: 3 },
  { name: 'Biology', code: 'BIO', sort_order: 4 },
];

const DEFAULT_CHAPTERS = {
  PHY: [
    'Mechanics', 'Thermodynamics', 'Electricity & Magnetism', 'Waves & Optics',
    'Modern Physics', 'Electrodynamics', 'Heat & Kinetic Theory',
  ],
  CHEM: [
    'Physical Chemistry', 'Organic Chemistry', 'Inorganic Chemistry',
    'Environmental Chemistry', 'Bio Chemistry',
  ],
  MATH: [
    'Algebra', 'Trigonometry', 'Calculus', 'Coordinate Geometry',
    'Vectors & 3D Geometry', 'Differential Equations', 'Probability', 'Statistics',
  ],
  BIO: [
    'Cell Biology', 'Genetics & Evolution', 'Plant Biology', 'Animal Biology',
    'Human Physiology', 'Reproduction', 'Biotechnology', 'Ecology',
  ],
};

const seedDatabase = async () => {
  try {
    for (const subj of DEFAULT_SUBJECTS) {
      const [subject, created] = await Subject.findOrCreate({
        where: { code: subj.code },
        defaults: subj,
      });

      if (created) {
        logger.info(`Created subject: ${subject.name}`);
      }

      const chapters = DEFAULT_CHAPTERS[subj.code] || [];
      for (let i = 0; i < chapters.length; i++) {
        await Chapter.findOrCreate({
          where: { subject_id: subject.id, name: chapters[i] },
          defaults: {
            subject_id: subject.id,
            name: chapters[i],
            code: `${subj.code}${String(i + 1).padStart(2, '0')}`,
            sort_order: i,
          },
        });
      }
    }

    logger.info('Database seeding complete');
  } catch (error) {
    logger.error('Seeding failed:', error.message);
    throw error;
  }
};

module.exports = { seedDatabase, DEFAULT_SUBJECTS, DEFAULT_CHAPTERS };
