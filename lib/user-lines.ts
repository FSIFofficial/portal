/**
 * 表計算ソフトからのコピー（タブ区切り）やカンマ区切りの行から、名前とメールアドレスを取り出す。
 * 1行に1人。メールアドレス以外のセルは名前としてつなぐ。見出し行（メール・mail・e-mail）は飛ばす。
 */
export function parseUserLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(/\t|,|，/).map((c) => c.trim()).filter(Boolean)
      const email = cells.find((c) => c.includes('@')) ?? ''
      const name = cells.filter((c) => c !== email).join(' ')
      return { email: email.toLowerCase(), name, valid: /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(email) }
    })
    .filter((row) => !/^(メール|mail|e-?mail)/i.test(row.email))
}
