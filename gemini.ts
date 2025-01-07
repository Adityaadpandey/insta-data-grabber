const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const apiKey = "AIzaSyAg2bGH7Unh701ftOV1VDkM32S0Uc20cdM";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
  systemInstruction:
    "You are an expert data analyst specialized in social media analytics. Using the provided social media data, analyze the engagement metrics and provide actionable insights.\n\nRequired Analysis:\n1. Profile Overview\n- Analyze follower-following ratio\n- Calculate posting frequency\n- Assess account growth indicators\n\n2. Content Analysis\n- Evaluate hashtag usage and effectiveness\n- Identify posting patterns\n- Analyze content type distribution\n\n3. Key Insights (minimum 1)\n- Each insight should include:\n  * Finding\n  * Supporting data\n  * Confidence level (High/Medium/Low)\n\n4. Recommendations\n- Provide 3-5 actionable recommendations\n- Include expected impact\n- Prioritize based on data confidence\n\n\n\nQuestion: {question}\nAnswer:",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function run() {
  const chatSession = model.startChat({
    generationConfig,
    history: [],
  });

  const result = await chatSession.sendMessage(
    "Tell me like i am thinking to post something on social media what type of content should i post as being a data analyst",
  );
  console.log(result.response.text());
}

run();
