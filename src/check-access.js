import { code } from 'telegraf/format'
import { allowUsers } from './allow-users.js'

export async function checkAccess(ctx, operation) {
  try {
    if (allowUsers.includes(ctx.message.from.id)) {
      return true
    } else {
      await ctx.reply(code('Доступ запрещен'))
      console.log(`Access denied (${operation}): ${ctx.message.from.id}`);
      return false
    }
  } catch (error) {
    console.log('Check access error:', error.message);
  }
}
