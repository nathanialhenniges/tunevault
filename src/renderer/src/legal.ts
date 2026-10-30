const documents: Record<string, [file: string, title: string]> = {
  terms: ["terms-of-use", "Terms of use"],
  privacy: ["privacy-policy", "Privacy policy"],
  "third-party": ["third-party-notices", "Third-party notices"],
  install: ["install-update", "Install & update help"],
  license: ["license", "License"],
};

export async function readLegal(kind: string) {
  const [file, title] = documents[kind] || [kind, kind];
  const result = await window.tunevault.invoke("legal.read", { name: file });
  return {
    title,
    text:
      typeof result === "string" ? result : result.text || result.content || "",
  };
}
