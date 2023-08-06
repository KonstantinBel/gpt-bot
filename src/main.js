import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { removeFile } from './utils.js'
import { openai } from './openai.js'
import { checkAccess } from './check-access.js'

const TOKENS_LIMIT = 4096

let enableDebug = false
const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('debug', async (ctx) => {
  try {
    if (!await checkAccess(ctx, 'debug')) {
      return
    }
  
    enableDebug = !enableDebug
    await ctx.reply(code(`Режим отладки: ${enableDebug ? 'включен' : 'выключен'}`))
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.command('context', async (ctx) => {
  try {
    if (!await checkAccess(ctx, 'context')) {
      return
    }
  
    await ctx.reply(code(JSON.stringify(ctx.session, null, 2)))
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.command('system', async (ctx) => {
  try {
    if (!await checkAccess(ctx, 'system')) {
      return
    }
  
    ctx.session ??= { messages: [] }
    
    const userText = ctx.message.text.replace('/system ', '')
    ctx.session.messages.push({ role: openai.roles.System, content: userText })

    await ctx.reply(code(`Системное сообщение добавлено в контекст`))
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.command('new', async (ctx) => {
  try {
    if (!await checkAccess(ctx, 'new')) {
      return
    }
  
    await dropSession(ctx)
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.on(message('voice'), async ctx => {
  try {
    if (!await checkAccess(ctx, 'voice')) {
      return
    }
  
    ctx.session ??= { messages: [] }

    await ctx.reply(code('Начало обработки'))
    await ctx.sendChatAction('typing')

    const voiceLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = ctx.message.from.id

    const oggFile = await ogg.create(voiceLink.href, userId)
    const mp3File = await ogg.toMp3(oggFile, userId)
    const userText = await openai.getTranscription(mp3File)
    
    await ctx.reply(code(`Ваш запрос: ${userText}`))
    await processUserInput(userText, ctx)
    await removeFile(oggFile)
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.on(message('text'), async ctx => {
  try {
    if (!await checkAccess(ctx, 'text')) {
      return
    }

    ctx.session ??= { messages: [] }
    await ctx.reply(code('Идет обработки'))

    const userText = ctx.message.text
    await processUserInput(userText, ctx)
  } catch (error) {
    handleError(ctx, error)
  }
})

bot.launch()
console.log('Bot is launched');


// ===================================

async function dropSession(ctx) {
  openai.createNewApiInstance()
  ctx.session = { messages: [] }
  await ctx.reply(code('Сессия сброшена'))
}

async function processUserInput(userInput, ctx) {
  ctx.session.messages.push({ role: openai.roles.User, content: userInput })
  
  await ctx.sendChatAction('typing')
  const gptResponse = await openai.sendMessages(ctx.session.messages)

  if (!gptResponse) {
    console.log('Warning: tokens limit')
    await ctx.reply(code('Достигнул лимит токенов'))
    await dropSession(ctx)

    return
  }

  const gptMessage = gptResponse.data.choices[0].message
  ctx.session.messages.push(gptMessage)
  
  await ctx.reply(gptMessage?.content || 'Пустой ответ от API')
  await ctx.reply(code(`Доступно токенов: ${TOKENS_LIMIT - gptResponse.data.usage.total_tokens}`))
}

function handleStopProcess(event) {
  console.log(event);
  bot.stop(event)
}

async function handleError(ctx, error) {
  console.error(error.stack)
  await ctx.reply(code(error.message))
}

process.once('SIGINT', handleStopProcess)
process.once('SIGTERM', handleStopProcess)
