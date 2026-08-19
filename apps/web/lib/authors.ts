/**
 * Blog author profiles. Google leans hard on who is making the claim for
 * "best tool" content, so posts carry a named person with a bio, an avatar and
 * verifiable profiles (emitted as schema.org Person.sameAs in the post layout),
 * not an anonymous "Creator AI Team".
 *
 * `author` on a BlogPost is matched against `name` here; posts with no matching
 * profile fall back to the organization byline.
 */
export interface BlogAuthor {
  name: string;
  /** One line under the byline on the post page. */
  title: string;
  /** Two or three sentences, shown in the author card at the end of a post. */
  bio: string;
  /** Path under public/, e.g. "/authors/afrin-nahar.jpg". */
  avatar: string;
  /** Public profiles. Empty strings are skipped, both in the UI and in sameAs. */
  x?: string;
  linkedin?: string;
  youtube?: string;
}

export const AUTHORS: Record<string, BlogAuthor> = {
  "Afrin Nahar": {
    name: "Afrin Nahar",
    title: "Founder, Creator AI",
    bio: "Afrin builds Creator AI and runs a YouTube channel with it, which is where the numbers in these posts come from. Every tool comparison here is written after actually paying for and shipping with the tools involved.",
    // 400x400 face-centred square cropped from public/afrin-nahar.jpg. Square
    // because it renders in a circle at 32px and 64px, and because Google wants
    // a clear headshot for Person.image.
    avatar: "/authors/afrin-nahar.jpg",
    x: "https://x.com/afrinxnahar",
    linkedin: "https://www.linkedin.com/in/afrinxnahar/",
  },
};

export function getAuthor(name: string): BlogAuthor | undefined {
  return AUTHORS[name];
}

/** Non-empty public profile URLs, for schema.org Person.sameAs. */
export function authorProfileUrls(author: BlogAuthor): string[] {
  return [author.x, author.linkedin, author.youtube].filter(
    (url): url is string => !!url,
  );
}
