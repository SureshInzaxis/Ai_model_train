const request = require('supertest');
const app = require('../src/app');

describe('Health Check', () => {
  it('should return server status', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toContain('Exam Question Analyzer');
    expect(res.body.status).toBe('running');
  });

  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('ollama');
  });

  it('should return database stats', async () => {
    const res = await request(app).get('/api/health/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty('questions');
    expect(res.body.stats).toHaveProperty('subjects');
  });
});
