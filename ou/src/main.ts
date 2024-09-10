const config = {
  namespaces: ["o", "en", "de"],
  language: "en",
  country: "de",
  defaultKeyword: "g",
};

const ARG_REGEX = /<([a-zA-Z0-9_])+>/g;

const shortcutKeys = [...config.namespaces, `.${config.country}`];

const namespaces = await Promise.all(
  shortcutKeys.map(async (key) => {
    const res = await fetch(`data/shortcuts/${key}.json`);
    return { key, etag: res.headers.get("etag"), parse: () => res.json() };
  }),
);

const etags = JSON.stringify(namespaces.map((ns) => ns.etag));
if (localStorage.getItem("etags") !== etags) {
  const shortcutInfos = Object.assign({}, ...(await Promise.all(namespaces.map((ns) => ns.parse()))));
  for (const [key, info] of Object.entries(shortcutInfos)) {
    localStorage.setItem(key, JSON.stringify(info));
  }
  localStorage.setItem("etags", etags);
}

const searchParams = new URLSearchParams(location.hash.slice(1));
const query = searchParams.get("query") ?? "";
const [queryPrefix, ...queryRest] = query.split(" ");
console.log({ queryRest });
const args = queryRest
  .join(" ")
  .split(",")
  .map((arg) => arg.trim());

const key = `${queryPrefix.toLowerCase()} ${args.length}`;
const storedItem = localStorage.getItem(key);
if (storedItem) {
  const item = JSON.parse(storedItem) as { url: string };

  const localURL = item.url.replaceAll("<$language>", config.language);
  const params = [...new Set(localURL.match(ARG_REGEX) ?? [])];

  const finalURL = params.reduce((s, param, i) => s.replaceAll(param, args[i]), localURL);
  location.replace(finalURL);
} else {
  const item = JSON.parse(localStorage.getItem(`${config.defaultKeyword} 1`)!) as { url: string };
  const localURL = item.url.replaceAll("<$language>", config.language);
  const params = [...new Set(localURL.match(ARG_REGEX) ?? [])];
  const finalURL = params.reduce((s, param) => s.replaceAll(param, query), localURL);
  location.replace(finalURL);
}
