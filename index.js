const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const { getConnection, createConnection } = require("./db");
createConnection();

// IIFE - Immediately Invoked Function Expression

async function primero() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(
    "https://www.linkedin.com/jobs/search?keywords=Frontend%20Developer&location=Colombia&locationId=&geoId=100876405&f_TPR=r86400&position=1&pageNum=0",
  );
  await page.setViewport({
    width: 1440,
    height: 781,
  });

  let end = false;

  const loadMoreButton = await page.$("#main-content > section.two-pane-serp-page__results-list > button");

  while (!end) {
    const isLastElementHidden = await page.evaluate(() => {
      return document.querySelector(".see-more-jobs__viewed-all").classList.contains("hidden");
    });

    if (isLastElementHidden) {
      await autoScroll(page);
      await page.waitForTimeout(1000);
      await loadMoreButton.evaluate((b) => b.click());
      console.log("Clicking");
    } else {
      end = true;
    }
  }

  const pageData = await page.evaluate(() => {
    return { html: document.body.innerHTML };
  });

  const $ = cheerio.load(pageData.html);

  const cards = $(".base-card");
  cards.each(async (i, el) => {
    const job = {
      title: $(el).find(".base-search-card__title").text().trim(),
      company: $(el).find(".hidden-nested-link").text().trim(),
      img: $(el).find(".artdeco-entity-image").attr("src"),
      link: $(el).find(".base-card__full-link").attr("href"),
    };
    await getConnection().get("jobs").push(job).write();
  });

  await browser.close();
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function segunda(element) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // await page.waitForTimeout(10000);
  await page.goto(element.link, { waitUntil: "domcontentloaded" });

  // await page.waitForTimeout(10000);
  await page.setViewport({
    width: 1440,
    height: 781,
  });
  // No siempre está, bro.
  // await page.waitForSelector(".show-more-less-html__markup");
  await page.waitForSelector("body");
  const pageData = await page.evaluate(() => {
    return { html: document.body.innerHTML };
  });
  const $ = cheerio.load(pageData.html);
  const description = $(".show-more-less-html__markup")
    .text()
    .trim()
    .replace(/\n|<.*?>/g, "");

  await getConnection()
    .get("jobs")
    .find({ link: element.link })
    .assign({ ...element, description })
    .write();

  await browser.close();
  // await page.waitForTimeout(500);
}

(async () => {
  await primero();
  const jobsArray = await getConnection().get("jobs").value();
  console.log(jobsArray.length);
  for (let i = 0; i < jobsArray.length; i++) {
    const element = jobsArray[i];
    if (element.link) {
      await segunda(element);
    }
  }
})();