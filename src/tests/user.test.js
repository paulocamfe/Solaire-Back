const request = require('supertest');
const app = require('../App');

describe('User API', () => {
  it('should not register user with invalid email', async () => {
    const res = await request(app).post('/users').send({ email: 'bad', password: '123456', name: 'Test' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});