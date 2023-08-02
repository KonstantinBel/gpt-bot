import { code } from 'telegraf/format'
import { allowUsers } from './allow-users.js'

export async function checkAccess(ctx, operation) {
  console.log(`Operation (${ctx.message.from.username}): ${operation}`);

  if (allowUsers.includes(ctx.message.from.id)) {
    return true
  } else {
    await ctx.reply(code('Доступ запрещен'))
    console.log(`Access denied (${operation}): ${ctx.message.from.id}`);
    return false
  }
}
