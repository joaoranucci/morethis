import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

let content;
try { content = await readFile(".env", "utf8"); } catch (error) {
  if (error.code !== "ENOENT") throw error;
  content = await readFile(".env.example", "utf8");
}
if (!/^BETTER_AUTH_SECRET=.+$/m.test(content) || /^BETTER_AUTH_SECRET=replace-.*$/m.test(content)) {
  content = content.replace(/^BETTER_AUTH_SECRET=.*\r?\n?/m, "");
  content += `\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`;
}
if (!/^BETTER_AUTH_URL=.+$/m.test(content)) content += "BETTER_AUTH_URL=http://127.0.0.1:3000\n";
await writeFile(".env", content, { mode: 0o600 });
console.log("Ambiente local configurado. Segredos não foram exibidos.");
