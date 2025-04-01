import { redirect } from "next/navigation";

/**
 * Generates a random 10-character string
 * @returns A random 10-character string
 */
function getRandomString(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

export default function Home() {
  // Generate a random, readable slug
  const randomSlug = getRandomString();
  redirect(`/${randomSlug}`);
}
