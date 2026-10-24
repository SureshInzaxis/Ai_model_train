const request = require('supertest');
const app = require('../src/app');

describe('Questions API', () => {
  it('should list questions with pagination', async () => {
    const res = await request(app)
      .get('/api/questions')
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('total');
  });

  it('should return question options', async () => {
    const res = await request(app).get('/api/questions/options');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('subjects');
  });

  it('should return 404 for non-existent question', async () => {
    const res = await request(app).get('/api/questions/999999');
    expect(res.statusCode).toBe(404);
  });
});
