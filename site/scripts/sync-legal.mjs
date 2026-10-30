// Copies the legal documents from ../docs so the website always shows the
// same text that ships with the app. Output is generated and gitignored.
import { readFile, writeFile } from "node:fs/promises";

const repo = "https://github.com/nathanialhenniges/tunevault/blob/main/docs/";
const pages = [
  ["privacy-policy", "Privacy Policy", "What TuneVault stores, what it sends, and to whom."],
  ["terms-of-use", "Terms of Use", "The rules for using TuneVault."],
  ["third-party-notices", "Third-party notices", "Open-source components and their licenses."],
];

for (const [name, title, description] of pages) {
  const source = await readFile(new URL(`../../docs/${name}.md`, import.meta.url), "utf8");
  const body = source
    .replace(/^# .*\n+/, "") // the page title comes from the frontmatter
    .replace(/\]\((?!https?:|#)([^)]+)\)/g, (_, path) => `](${new URL(path, repo)})`);
  await writeFile(
    new URL(`../content/docs/legal/${name}.md`, import.meta.url),
    `---\ntitle: ${title}\ndescription: ${description}\n---\n\n${body}`,
  );
}
