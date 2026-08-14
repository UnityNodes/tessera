import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * /case is no longer a page but a link to the home page.
   *
   * The case catalogue was a separate section with the same deck cards as on the
   * home page, written a second time in a different file. There is one catalogue
   * now and it lives on the home page; the route itself stays working, because it
   * may already have been linked from outside.
   *
   * `source: "/case"` matches exactly this path and does NOT touch `/case/[id]`,
   * nested paths do not come here. That matters: the deck page itself has not
   * gone anywhere.
   *
   * 307 rather than 308: a permanent redirect is cached by browsers forever, and
   * if the catalogue ever comes back as a separate page it will stay broken for
   * everyone who visited.
   */
  redirects() {
    return Promise.resolve([{ source: "/case", destination: "/#decks", permanent: false }]);
  },
};

export default nextConfig;
