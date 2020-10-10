import { launch, Page } from "puppeteer";
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));


type GraphNode = {
  from: string,
  to: string
}

type Graph = GraphNode[]

const getUrls = async (pattern: string, ignorePattern: string, page: Page, nextUrl: Readonly<string>): Promise<{ urls: string[]; graph: Graph }> => {
  await page.goto(nextUrl)
  const urls = await page.evaluate((pattern, ignorePattern) => {
    const urlPattern = new RegExp(pattern)
    const ignoreUrlPattern = new RegExp(ignorePattern)
    const nodeList = document.querySelectorAll("[href]");
    return Array.from(new Set(Array.from(nodeList).map(n => n.getAttribute("href")).filter(x => urlPattern.test(x) && !ignoreUrlPattern.test(x)))) || []
  }, pattern, ignorePattern);
  return {
    urls,
    graph: urls.map(u => ({ from: nextUrl, to: u }))
  }
}

const toSting = (graph: Graph): string => `
digraph G {
	${graph.map(({ from, to }) => '"' + from + '" -> "' + to + '"').join(";\n        ")}
}
`


const run = async (startUrl: string, pattern: string, ignorePattern: string) => {
  const browser = await launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  const { urls, graph } = await getUrls(pattern, ignorePattern, page, startUrl);
  // 次のパス 10個だけ
  const { u, g } = await urls.slice(0, 10).reduce(async (prev: Promise<{ u: string[]; g: Graph }>, url: string) => {
    try {
      const { u, g } = await prev;
      const { urls, graph } = await getUrls(pattern, ignorePattern, page, url);
      await sleep(1000);
      console.log(`go: ${url}`)
      return { u: [...u, ...urls], g: [...g, ...graph] };
    } catch (err) {
      console.log(err);
      return { u, g }
    }
  }, { u: urls, g: graph });
  console.log(urls)
  console.log(toSting(g))
  await browser.close()
}

run(process.argv[2], process.argv[3], process.argv[4]);