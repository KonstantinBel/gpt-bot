import { Configuration, OpenAIApi } from 'openai'
import config from 'config'
import { createReadStream } from 'fs'

class OpenAI {
  roles = {
    System: 'system',
    User: 'user',
    Assistant: 'assistant',
    Function: 'function',
  }

  constructor() {
    const configuration = new Configuration({
      apiKey: config.get('OPENAI_API_KEY'),
    })

    this.openai = new OpenAIApi(configuration);
  }

  async chat(messages) {
    try {
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
      })

      return response.data.choices[0].message.content
    } catch (error) {
      console.log('Chat error:', error.message);
    }
  }

  async transcription(filePath) {
    try {
      const response = await this.openai.createTranscription(
        createReadStream(filePath),
        'whisper-1',
      )

      return response.data.text
    } catch (error) {
      console.log('Transcription error:', error.message)
    }
  }
}

export const openai = new OpenAI()