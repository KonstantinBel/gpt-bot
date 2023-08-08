import { getCurrentDateTime } from './utils.js'
import { code } from 'telegraf/format'
import { allowUsers } from './allow-users.js'

export async function checkAccess(ctx, operation) {
  if (allowUsers.includes(ctx.message.from.id)) {
    return true
  } else {
    await ctx.reply(code('Доступ запрещен'))
    console.log(getCurrentDateTime(), '-',  `access denied (${operation}): ${ctx.message.from.id}`);
    return false
  }
}
