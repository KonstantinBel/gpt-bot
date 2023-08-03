import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { removeFile } from './utils.js'
import { openai } from './openai.js'
import { checkAccess } from './check-access.js'

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
    
    await ctx.sendChatAction('typing')
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
    await ctx.sendChatAction('typing')
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

    await ctx.reply(code('Начало обработки'))
    await ctx.sendChatAction('typing')

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
  console.log(`User input (${ctx.message.from.username}): ${userInput}`);
  ctx.session.messages.push({ role: openai.roles.User, content: userInput })
  const gptResponse = await openai.sendMessages(ctx.session.messages)

  if (!gptResponse) {
    console.log(code('Warning: tokens limit'))
    await reply(code('Достигнул лимит токенов'))
    await dropSession()

    return
  }

  const gptMessage = gptResponse.data.choices[0].message
  console.log(`GPT output (${ctx.message.from.username}): ${gptMessage?.content}`);
  ctx.session.messages.push(gptMessage)
  
  await ctx.reply(code(`Использовано токенов: ${gptResponse.data.usage.total_tokens}`))
  await ctx.reply(gptMessage?.content || 'Пустой ответ от API')
}

function handleStopProcess(event) {
  console.log(event);
  bot.stop(event)
}

async function handleError(ctx, error) {
  console.log('Error:', error.stack)
  await ctx.reply(code(error.message))
}

process.once('SIGINT', handleStopProcess)
process.once('SIGTERM', handleStopProcess)
