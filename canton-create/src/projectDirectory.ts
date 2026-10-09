import fs from 'node:fs'
import path from 'node:path'

export const isEmptyDir = (dir: string): boolean =>
  !fs.existsSync(dir) || fs.readdirSync(dir).filter((name) => name !== '.git').length === 0

/** Undoes a failed run: deletes the folder it created, or empties the one it was given except `.git`. */
export const removeScaffold = (dir: string, existedBefore: boolean): void => {
  if (!existedBefore) {
    fs.rmSync(dir, { recursive: true, force: true })
    return
  }
  for (const name of fs.readdirSync(dir)) {
    if (name !== '.git') {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
}
