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
  enableDebug = !enableDebug
  await ctx.reply(`Debug mode: ${enableDebug}`)
})

bot.command('context', async (ctx) => {
  await ctx.reply(code(JSON.stringify(ctx.session, null, 2)))
})

bot.command('system', async (ctx) => {
  console.log('Command: system');

  const hasAccess = await checkAccess(ctx, 'system')

  if (!hasAccess) {
    return
  }

  ctx.session ??= { messages: [] }
  
  await ctx.sendChatAction('typing')
  const userText = ctx.message.text.replace('/system ', '')
  ctx.session.messages.push({ role: openai.roles.System, content: userText })
  await ctx.reply(code(`Системное сообщение добавлено в контекст`))
})

bot.command('new', async (ctx) => {
  console.log('Command: new');

  const hasAccess = await checkAccess(ctx, 'new')

  if (!hasAccess) {
    return
  }

  openai.createNewApiInstance()
  ctx.session = { messages: [] }
  await ctx.reply(code('Сессия сброшена'))
})

bot.on(message('voice'), async ctx => {
  console.log(`Start processing (${ctx.message.from.username}): voice`);

  const hasAccess = await checkAccess(ctx, 'voice')

  if (!hasAccess) {
    return
  }

  ctx.session ??= { messages: [] }

  try {
    await ctx.reply(code('start processing'))
    await ctx.sendChatAction('typing')

    const voiceLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = ctx.message.from.id

    const oggFile = await ogg.create(voiceLink.href, userId)
    const mp3File = await ogg.toMp3(oggFile, userId)
    const userText = await openai.getTranscription(mp3File)
    
    console.log(`User input(${ctx.message.from.username}): ${userText}`);

    await ctx.reply(code(`ваш запрос: ${userText}`))
    await ctx.sendChatAction('typing')
    await processUserInput(userText, ctx)
    await removeFile(oggFile)
  } catch (error) {
    console.log('Voice message error:', error.message)
    await ctx.reply(`Error: ${error.message}`)
  }
})

bot.on(message('text'), async ctx => {
  console.log(`Start processing (${ctx.message.from.username}): text`);

  const hasAccess = await checkAccess(ctx, 'text')

  if (!hasAccess) {
    return
  }

  ctx.session ??= { messages: [] }

  try {
    await ctx.reply(code('start processing...'))
    await ctx.sendChatAction('typing')

    const userText = ctx.message.text

    await processUserInput(userText, ctx)
  } catch (error) {
    console.log('Text message error:', error.message)
    await ctx.reply(`Error: ${error.message}`)
  }
})

bot.launch()
console.log('Bot is launched');


// ===================================

async function processUserInput(userInput, ctx) {
  console.log(`User input(${ctx.message.from.username}): ${userInput}`);

  ctx.session.messages.push({ role: openai.roles.User, content: userInput })
  
  const gptResponse = await openai.sendMessages(ctx.session.messages)
  const gptMessage = gptResponse.data.choices[0].message

  if (enableDebug) {
    await ctx.reply(code(JSON.stringify(gptResponse.data, null, 2)))
  }

  console.log(`GPT output(${ctx.message.from.username}): ${gptMessage?.content}`);
  ctx.session.messages.push(gptMessage)
  
  await ctx.reply(gptMessage?.content || 'GPT API response in empty')
}

function handleStopProcess(event) {
  console.log(event);
  bot.stop(event)
}

process.once('SIGINT', handleStopProcess)
process.once('SIGTERM', handleStopProcess)
