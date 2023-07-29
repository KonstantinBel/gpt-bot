import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { removeFile } from './utils.js'
import { openai } from './openai.js'

const INITIAL_SESSION = {
  messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async (ctx) => {
  console.log('Command: new');

  ctx.session = { ...INITIAL_SESSION }
  await ctx.reply(code('Сессия сброшена'))
})

bot.on(message('voice'), async ctx => {
  console.log(`Start processing (${ctx.message.from.username}): voice`);
  ctx.session ??= { ...INITIAL_SESSION }

  try {
    await ctx.reply(code('processing...'))

    const voiceLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = ctx.message.from.id

    const oggFile = await ogg.create(voiceLink.href, userId)
    const mp3File = await ogg.toMp3(oggFile, userId)
    const userText = await openai.transcription(mp3File)
    
    console.log(`User input(${ctx.message.from.username}): ${userText}`);
    await ctx.reply(code(`ваш запрос: ${userText}`))

    ctx.session.messages.push({ role: openai.roles.User, content: userText })

    const responseText = await openai.chat(ctx.session.messages)
    console.log(`GPT output(${ctx.message.from.username}): ${responseText}`);

    ctx.session.messages.push({ role: openai.roles.Assistant, content: responseText })
    
    await ctx.reply(responseText)
    await removeFile(oggFile)
  } catch (error) {
    console.log('Voice message error:', error.message)
    await ctx.reply(`Error: ${error.message}`)
  }
})

bot.on(message('text'), async ctx => {
  console.log(`Start processing (${ctx.message.from.username}): text`);
  ctx.session ??= { ...INITIAL_SESSION }

  try {
    await ctx.reply(code('processing...'))

    const userText = ctx.message.text
    console.log(`User input(${ctx.message.from.username}): ${userText}`);

    ctx.session.messages.push({ role: openai.roles.User, content: userText })

    const responseText = await openai.chat(ctx.session.messages)
    console.log(`GPT output(${ctx.message.from.username}): ${responseText}`);

    ctx.session.messages.push({ role: openai.roles.Assistant, content: responseText })
    
    await ctx.reply(responseText)
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
