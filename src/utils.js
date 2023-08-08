import { unlink } from 'fs/promises'

export async function removeFile(path) {
  try {
    await unlink(path)
  } catch (error) {
    console.log(getCurrentDateTime(), '-',  'remove file error:', error.message)
    throw error
  }
}

export function getCurrentDateTime() {
  const date = new Date();
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };

  const formatter = new Intl.DateTimeFormat('ru-RU', options);
  const formattedDateTime = formatter.format(date);

  return formattedDateTime;
}
