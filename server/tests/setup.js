const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { sequelize } = require('../src/config/database');
const { syncModels } = require('../src/models');

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    await syncModels(true);
  } catch (error) {
    console.error('Test DB setup failed:', error.message);
  }
});

afterAll(async () => {
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Test DB teardown failed:', error.message);
  }
});
