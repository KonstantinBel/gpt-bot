import axios from "axios"
import ffmpeg from 'fluent-ffmpeg'
import installer from '@ffmpeg-installer/ffmpeg'
import { createWriteStream } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { getCurrentDateTime } from './utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

class OggConverter {
  constructor() {
    ffmpeg.setFfmpegPath(installer.path)
  }

  toMp3(inputFile, outputFileName) {
    try {
      const outputFile = resolve(dirname(inputFile), `${outputFileName}.mp3`)

      return new Promise((resolve, reject) => {
        ffmpeg(inputFile)
          .inputOption('-t 30')
          .output(outputFile)
          .on('end', () => resolve(outputFile))
          .on('error', (error) => reject(error.message))
          .run()
          
      })
    } catch (error) {
      console.log(getCurrentDateTime(), '-',  'convert to mp3 error:', error.message)
      throw error
    }
  }

  async create(url, fileName) {
    try {
      const oggPath = resolve(__dirname, '../voices', `${fileName}.ogg`)

      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
      })

      return new Promise((resolve) => {
        const stream = createWriteStream(oggPath)

        response.data.pipe(stream)
        stream.on('finish', () => { resolve(oggPath) })      
      })

    } catch (error) {
      console.log(getCurrentDateTime(), '-',  'create ogg error:', error.message)
      throw error
    }
  }
}

export const ogg = new OggConverter()
