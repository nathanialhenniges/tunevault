import keys from "../../resources/update-keys.json";

export function updateOptions(): { publicKeys: string[] } {
  return { publicKeys: keys.publicKeys };
}
