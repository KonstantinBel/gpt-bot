import { Configuration, OpenAIApi } from 'openai'
import config from 'config'
import { createReadStream } from 'fs'

const TIMEOUT = 120000

class OpenAI {
  roles = {
    System: 'system',
    User: 'user',
    Assistant: 'assistant',
    Function: 'function',
  }

  constructor() {
    this.createNewApiInstance()
  }

  createNewApiInstance() {
    const configuration = new Configuration({
      apiKey: config.get('OPENAI_API_KEY'),
    })

    this.openai = new OpenAIApi(configuration)
  }

  async sendMessages(messages) {
    try {
      const response = await Promise.race([
        this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages,
        }),
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Process message timeout')), TIMEOUT);
        }),
      ]);
  
      return response      
    } catch (error) {
      console.log('Chat error:', error.message)
      throw error
    }
  }

  async getTranscription(filePath) {
    try {
      const response = await Promise.race([
        this.openai.createTranscription(
          createReadStream(filePath),
          'whisper-1',
        ),
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Transcription message timeout')), TIMEOUT);
        }),
      ]);
  
      return response.data.text      
    } catch (error) {
      console.log('Chat error:', error.message)
      throw error
    }
  }
}

export const openai = new OpenAI()