import puppeteer, { Browser, Page } from "puppeteer";

interface PostData {
  type: "image" | "video" | "carousel" | "reel";
  likes: number;
  hashtags: string[];
  caption: string;
  postUrl: string;
  timestamp: string;
}

interface UserProfile {
  username: string;
  bio: string;
  posts: PostData[];
  followersCount: number;
  followingCount: number;
}

class SocialMediaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1280, height: 800 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
        ],
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      );

      await this.page.setRequestInterception(true);

      this.page.on("request", (request) => {
        const resourceType = request.resourceType();
        if (["image", "stylesheet", "font"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    } catch (error) {
      console.error("Failed to initialize scraper:", error);
      throw error;
    }
  }

  private async waitForSelector(selector: string, timeout = 5000) {
    if (!this.page) throw new Error("Page not initialized");
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.error(`Timeout waiting for selector: ${selector}`);
      return false;
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return text.match(hashtagRegex) || [];
  }

  private parseLikeCount(text: string): number {
    try {
      const cleanText = text.replace(/[,\s]/g, "").toLowerCase();
      if (cleanText.includes("k")) {
        return parseFloat(cleanText) * 1000;
      }
      if (cleanText.includes("m")) {
        return parseFloat(cleanText) * 1000000;
      }
      return parseInt(cleanText) || 0;
    } catch {
      return 0;
    }
  }

  async scrapeUserProfile(username: string): Promise<UserProfile> {
    if (!this.page) throw new Error("Scraper not initialized");

    try {
      // Navigate to profile page
      console.log(`Navigating to profile: ${username}`);
      await this.page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for login check
      if (await this.waitForSelector('input[name="username"]')) {
        throw new Error("Login required to view this profile");
      }

      // Wait for profile content to load
      await this.waitForSelector("header section");

      // Extract bio
      const bio = await this.page.evaluate(() => {
        const bioElement = document.querySelector("header section span");
        return bioElement ? bioElement.textContent || "" : "";
      });

      console.log("Bio extracted successfully");

      // Extract follower counts
      const followersCount = await this.page.evaluate(() => {
        const element = document.querySelector(
          "header section ul li:nth-child(2) span",
        );
        return element ? parseInt(element.textContent || "0", 10) : 0;
      });

      const followingCount = await this.page.evaluate(() => {
        const element = document.querySelector(
          "header section ul li:nth-child(3) span",
        );
        return element ? parseInt(element.textContent || "0", 10) : 0;
      });

      console.log("Follower counts extracted");

      // Extract posts
      const posts: PostData[] = [];

      // Get all post links
      const postLinks = await this.page.evaluate(() => {
        const links = document.querySelectorAll("article a");
        return Array.from(links, (link) => link.href).slice(0, 4); // Get first 12 posts
      });

      console.log(`Found ${postLinks.length} posts`);

      // Process each post
      for (const link of postLinks) {
        try {
          await this.page.goto(link, { waitUntil: "networkidle0" });

          const postData = await this.page.evaluate(() => {
            const caption =
              document.querySelector("article h1")?.textContent || "";
            const likes =
              document.querySelector("article section span")?.textContent ||
              "0";
            const timestamp = document.querySelector("time")?.dateTime || "";

            return {
              caption,
              likes,
              timestamp,
            };
          });

          const hashtags = this.extractHashtags(postData.caption);

          posts.push({
            type: "image", // Default to image, you can enhance this later
            likes: this.parseLikeCount(postData.likes),
            hashtags,
            caption: postData.caption,
            postUrl: link,
            timestamp: postData.timestamp,
          });

          console.log(`Processed post: ${link}`);

          // Add a small delay between posts
          await this.page.waitForTimeout(1000);
        } catch (error) {
          console.error(`Error processing post ${link}:`, error);
          continue;
        }
      }

      return {
        username,
        bio,
        posts,
        followersCount,
        followingCount,
      };
    } catch (error) {
      console.error(`Error scraping profile ${username}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Example usage
async function main() {
  const scraper = new SocialMediaScraper();
  try {
    console.log("Initializing scraper...");
    await scraper.initialize();
    console.log("Scraper initialized successfully");

    const username = "adp_alpha"; // Replace with actual username
    console.log(`Starting to scrape profile: ${username}`);

    const profile = await scraper.scrapeUserProfile(username);

    console.log("\nProfile Data:");
    console.log("Bio:", profile.bio);
    console.log("Followers:", profile.followersCount);
    console.log("Following:", profile.followingCount);

    console.log("\nPosts Data:");
    profile.posts.forEach((post, index) => {
      console.log(`\nPost ${index + 1}:`);
      console.log("Type:", post.type);
      console.log("Likes:", post.likes);
      console.log("Hashtags:", post.hashtags.join(", "));
      console.log("Posted:", new Date(post.timestamp).toLocaleDateString());
    });
  } catch (error) {
    console.error("Scraping failed:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
  } finally {
    try {
      await scraper.close();
      console.log("Scraper closed successfully");
    } catch (closeError) {
      console.error("Error while closing scraper:", closeError);
    }
  }
}

// Run the scraper
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
