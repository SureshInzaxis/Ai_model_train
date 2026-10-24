const axios = require('axios');
const logger = require('./logger');

class OllamaService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen3.8:27b';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);
    this.maxTokens = parseInt(process.env.OLLAMA_MAX_TOKENS || '4096', 10);
    this.temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.3');
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
  }

  async isAvailable() {
    try {
      const response = await this.client.get('/api/tags');
      return { available: true, models: response.data.models || [] };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  async getModelInfo() {
    try {
      const response = await this.client.get('/api/show', {
        params: { model: this.model },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get model info:', error.message);
      return null;
    }
  }

  async generate(prompt, options = {}) {
    const {
      model = this.model,
      temperature = this.temperature,
      maxTokens = this.maxTokens,
      format = null,
    } = options;

    const requestBody = {
      model,
      prompt,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    if (format) {
      requestBody.format = format;
    }

    try {
      const response = await this.client.post('/api/generate', requestBody);
      return this.parseResponse(response.data);
    } catch (error) {
      logger.error('Ollama generate error:', error.message);
      throw error;
    }
  }

  async generateWithFormat(prompt, schema) {
    try {
      return await this.generate(prompt, { format: 'json' });
    } catch (error) {
      logger.warn('Ollama JSON format request failed, falling back to text:', error.message);
      const result = await this.generate(prompt, { format: null });
      return { response: result.response };
    }
  }

  async chat({ prompt, images = [], format = 'json' }) {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt,
          ...(images.length ? { images } : {}),
        },
      ],
      stream: false,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens,
      },
    };
    if (format) requestBody.format = format;

    try {
      const response = await this.client.post('/api/chat', requestBody);
      const content = response.data?.message?.content || response.data?.response || '';
      return {
        response: content,
        model: response.data?.model,
        done: response.data?.done,
        evalCount: response.data?.eval_count,
        evalDuration: response.data?.eval_duration,
      };
    } catch (error) {
      logger.warn(`Ollama chat failed (${images.length} images): ${error.message}`);
      throw error;
    }
  }

  parseResponse(data) {
    if (data.response) {
      return {
        response: data.response,
        model: data.model,
        done: data.done,
        totalDuration: data.total_duration,
        evalCount: data.eval_count,
        evalDuration: data.eval_duration,
      };
    }
    return data;
  }

  async checkModelExists(modelName = null) {
    const model = modelName || this.model;
    try {
      const tags = await this.isAvailable();
      if (!tags.available) return false;
      return tags.models.some(m => m.name === model);
    } catch {
      return false;
    }
  }
}

module.exports = new OllamaService();
