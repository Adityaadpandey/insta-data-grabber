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

interface LoginCredentials {
  username: string;
  password: string;
}

class SocialMediaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async initialize(credentials?: LoginCredentials) {
    try {
      this.browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1920, height: 1080 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080",
        ],
      });

      this.page = await this.browser.newPage();

      // Set a more realistic viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set a more realistic user agent
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      // Add additional headers
      await this.page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Connection: "keep-alive",
        "Accept-Encoding": "gzip, deflate, br",
      });

      // Only login if credentials are provided
      if (credentials) {
        await this.login(credentials);
      }
    } catch (error) {
      console.error("Failed to initialize scraper:", error);
      throw error;
    }
  }

  private async login(credentials: LoginCredentials) {
    if (!this.page) throw new Error("Page not initialized");

    try {
      // Navigate to Instagram login page
      await this.page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for cookie dialog and accept it if present
      try {
        const cookieButton = await this.page.$(
          '[role="dialog"] button:first-child',
        );
        if (cookieButton) {
          await cookieButton.click();
          await this.delay(1000);
        }
      } catch (e) {
        console.log("No cookie dialog found");
      }

      // Wait for the login form
      await this.page.waitForSelector('input[name="username"]');
      await this.page.waitForSelector('input[name="password"]');

      // Type credentials with random delays
      await this.page.type('input[name="username"]', credentials.username, {
        delay: 100,
      });
      await this.page.type('input[name="password"]', credentials.password, {
        delay: 150,
      });

      // Click login button
      await this.page.click('button[type="submit"]');

      // Wait for navigation
      await this.page.waitForNavigation({ waitUntil: "networkidle0" });

      // Check if login was successful
      const loginError = await this.page.$('p[role="alert"]');
      if (loginError) {
        throw new Error("Login failed - incorrect credentials");
      }

      this.isLoggedIn = true;
      console.log("Successfully logged in");

      // Wait a bit after login
      await this.delay(3000);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  async scrapeUserProfile(username: string): Promise<UserProfile> {
    if (!this.page) throw new Error("Scraper not initialized");

    try {
      // Add random delay before navigation
      await this.delay(Math.random() * 2000 + 1000);

      // Navigate to profile page
      await this.page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: "networkidle0",
        timeout: 300000,
      });

      // If not logged in, handle the login wall
      if (!this.isLoggedIn) {
        const loginWall = await this.page.$("text/Log in to Instagram");
        if (loginWall) {
          throw new Error("Login required to view this profile");
        }
      }

      // Wait longer for content to load
      await this.delay(3000);

      // Extract bio and counts with extended timeout
      const profileData = await this.page.evaluate(() => {
        const bioElement = document.querySelector<HTMLElement>("h1");
        const followerElement = document.querySelector(
          "li:nth-child(2) span span",
        );
        const followingElement = document.querySelector(
          "li:nth-child(3) span span",
        );

        return {
          bio: bioElement?.innerText || "",
          followers: followerElement?.innerText || "0",
          following: followingElement?.innerText || "0",
        };
      });

      // Convert follower counts
      const followersCount = this.parseCount(profileData.followers);
      const followingCount = this.parseCount(profileData.following);

      // Extract posts with scroll simulation
      const posts: PostData[] = [];
      const postLinks = await this.getPostLinks();

      for (const link of postLinks.slice(0, 4)) {
        try {
          const postData = await this.scrapePost(link);
          posts.push(postData);
          await this.delay(Math.random() * 1000 + 500);
        } catch (error) {
          console.error(`Error scraping post ${link}:`, error);
        }
      }

      return {
        username,
        bio: profileData.bio,
        posts,
        followersCount,
        followingCount,
      };
    } catch (error) {
      console.error(`Error scraping profile ${username}:`, error);
      throw error;
    }
  }

  private parseCount(count: string): number {
    const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
    const normalized = count.toLowerCase().replace(/,/g, "");
    const match = normalized.match(/^([\d.]+)([kmb])?$/);

    if (!match) return 0;

    const [, num, unit] = match;
    const value = parseFloat(num);
    return unit ? value * multipliers[unit as keyof typeof multipliers] : value;
  }

  private async getPostLinks(): Promise<string[]> {
    if (!this.page) throw new Error("Page not initialized");

    return await this.page.evaluate(() => {
      const links = document.querySelectorAll("article a");
      return Array.from(links, (link) => link.href);
    });
  }

  private async scrapePost(url: string): Promise<PostData> {
    if (!this.page) throw new Error("Page not initialized");

    await this.page.goto(url, { waitUntil: "networkidle0" });
    await this.delay(2000);

    const postData = await this.page.evaluate(() => {
      const caption = document.querySelector("h1")?.innerText || "";
      const likes =
        document.querySelector("section span span")?.innerText || "0";
      const timestamp = document.querySelector("time")?.dateTime || "";

      return { caption, likes, timestamp };
    });

    return {
      type: await this.determinePostType(),
      likes: this.parseCount(postData.likes),
      hashtags: this.extractHashtags(postData.caption),
      caption: postData.caption,
      postUrl: url,
      timestamp: postData.timestamp,
    };
  }

  private async determinePostType(): Promise<
    "image" | "video" | "carousel" | "reel"
  > {
    if (!this.page) throw new Error("Page not initialized");

    return await this.page.evaluate(() => {
      if (document.querySelector("video")) return "video";
      if (document.querySelector('[aria-label="Next"]')) return "carousel";
      if (document.location.pathname.includes("/reel/")) return "reel";
      return "image";
    });
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return text.match(hashtagRegex) || [];
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
    await scraper.initialize({
      username: "aditya_isfit",
      password: "jjyespapa@123",
    });

    const profile = await scraper.scrapeUserProfile("alluarjunonline");
    console.log(JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error("Scraping failed:", error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);
