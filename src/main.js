import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { removeFile } from './utils.js'
import { openai } from './openai.js'
import { checkAccess } from './check-access.js'

const INITIAL_SESSION = {
  messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('system', async (ctx) => {
  console.log('Command: system');

  const hasAccess = await checkAccess(ctx, 'system')

  if (!hasAccess) {
    return
  }

  
  ctx.session ??= { ...INITIAL_SESSION }
  
  await ctx.sendChatAction('typing')
  const userText = ctx.message.text.replace('/system ', '')
  ctx.session.messages.push({ role: openai.roles.System, content: userText })
  const gptResponse = await openai.sendMessages(ctx.session.messages)
  ctx.session.messages.push({ role: openai.roles.Assistant, content: gptResponse.content })
  
  await ctx.reply(code(`Системное сообщение передано: ${userText}`))
})

bot.command('new', async (ctx) => {
  console.log('Command: new');

  const hasAccess = await checkAccess(ctx, 'new')

  if (!hasAccess) {
    return
  }

  openai.createNewApiInstance()
  ctx.session = { ...INITIAL_SESSION }
  await ctx.reply(code('Сессия сброшена'))
})

bot.on(message('voice'), async ctx => {
  console.log(`Start processing (${ctx.message.from.username}): voice`);

  const hasAccess = await checkAccess(ctx, 'voice')

  if (!hasAccess) {
    return
  }

  ctx.session ??= { ...INITIAL_SESSION }

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

    ctx.session.messages.push({ role: openai.roles.User, content: userText })

    const gptResponse = await openai.sendMessages(ctx.session.messages)
    console.log(`GPT output(${ctx.message.from.username}): ${gptResponse.content}`);

    ctx.session.messages.push({ role: openai.roles.Assistant, content: gptResponse.content })
    
    if (!gptResponse.content) {
      await ctx.reply(code('GPT API is not responding. Try to reset session by /new command'))
      return
    }
    
    await ctx.reply(gptResponse.content)
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

  ctx.session ??= { ...INITIAL_SESSION }

  try {
    await ctx.reply(code('start processing...'))
    await ctx.sendChatAction('typing')

    const userText = ctx.message.text
    console.log(`User input(${ctx.message.from.username}): ${userText}`);

    ctx.session.messages.push({ role: openai.roles.User, content: userText })

    const gptResponse = await openai.sendMessages(ctx.session.messages)
    console.log(`GPT output(${ctx.message.from.username}): ${gptResponse.content}`);

    ctx.session.messages.push({ role: openai.roles.Assistant, content: gptResponse.content })
    
    if (!gptResponse.content) {
      await ctx.reply(code('GPT API is not responding. Try to reset session by /new command'))
      return
    }
    
    await ctx.reply(gptResponse.content)
  } catch (error) {
    console.log('Text message error:', error.message)
    await ctx.reply(`Error: ${error.message}`)
  }
})

bot.launch()
console.log('Bot is launched');


// ===================================

function handleStopProcess(event) {
  console.log(event);
  bot.stop(event)
}

process.once('SIGINT', handleStopProcess)
process.once('SIGTERM', handleStopProcess)
