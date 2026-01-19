/**
 * Mock Data Service
 * Generates realistic news articles for development
 */

import { NewsArticle } from '../types';
import { NewsCategory } from '../constants/appConfig';

const mockAuthors = [
  'John Smith', 'Emma Wilson', 'Michael Brown', 'Sarah Davis',
  'David Johnson', 'Emily Taylor', 'James Anderson', 'Olivia Martin',
  'Robert Thomas', 'Sophia Jackson', 'William White', 'Isabella Harris',
];

const sources = [
  'BBC News', 'CNN', 'The New York Times', 'The Guardian',
  'TechCrunch', 'Reuters', 'Bloomberg', 'Forbes',
  'ESPN', 'National Geographic', 'The Washington Post', 'Associated Press',
];

const technologyNews = [
  { title: 'AI Breakthrough: New Language Model Surpasses Human Performance', description: 'Researchers unveil a revolutionary AI system that demonstrates unprecedented understanding of complex reasoning tasks.' },
  { title: 'Apple Announces Next-Generation Processors with 40% Performance Boost', description: 'The tech giant reveals its latest chip architecture, promising significant improvements in speed and energy efficiency.' },
  { title: 'Quantum Computing Reaches Major Milestone in Error Correction', description: 'Scientists achieve breakthrough in making quantum computers more stable and reliable for practical applications.' },
  { title: 'Cybersecurity Alert: Major Vulnerability Discovered in Popular Software', description: 'Security researchers identify critical flaw affecting millions of users worldwide, patches being rolled out urgently.' },
  { title: 'Electric Vehicle Sales Surge 150% as Battery Technology Improves', description: 'New lithium-silicon batteries promise 500-mile range, accelerating the transition to electric transportation.' },
  { title: 'Breakthrough in Renewable Energy Storage Could Transform Power Grid', description: 'Innovative battery technology offers cost-effective solution for storing solar and wind energy at scale.' },
];

const businessNews = [
  { title: 'Global Markets Rally as Economic Data Exceeds Expectations', description: 'Stock markets worldwide see significant gains following positive employment and inflation reports.' },
  { title: 'Tech Giants Face New Antitrust Regulations in Multiple Countries', description: 'Governments worldwide coordinate efforts to regulate big tech companies and promote fair competition.' },
  { title: 'Startup Valued at $10 Billion After Revolutionary Healthcare Platform Launch', description: 'Healthcare technology company achieves unicorn status with AI-powered diagnostic system.' },
  { title: 'Central Banks Signal Interest Rate Changes Amid Inflation Concerns', description: 'Major central banks coordinate policy responses to address global economic challenges.' },
  { title: 'Merger Creates Largest Media Conglomerate in Entertainment History', description: 'Two industry giants combine forces, reshaping the landscape of content creation and distribution.' },
];

const sportsNews = [
  { title: 'Championship Victory: Underdog Team Wins Historic Finals in Overtime', description: 'After trailing for three quarters, the underdogs mount an incredible comeback to claim the title.' },
  { title: 'Olympic Committee Announces New Sports for 2028 Games', description: 'Breaking, skateboarding, and esports among additions to modernize the Olympic program.' },
  { title: 'Tennis Star Breaks Record with 25th Grand Slam Title', description: 'Legendary athlete cements legacy as the greatest of all time with another championship victory.' },
  { title: 'Soccer Transfer: Star Player Signs Record-Breaking $200M Deal', description: 'International superstar makes shocking move to new club in landmark transfer agreement.' },
  { title: 'Marathon Runner Shatters World Record by Over 30 Seconds', description: 'Kenyan athlete achieves what many thought impossible, pushing human limits in distance running.' },
];

const entertainmentNews = [
  { title: 'Box Office Smash: New Superhero Film Breaks Opening Weekend Records', description: 'Latest installment in popular franchise earns $300 million globally in its first three days.' },
  { title: 'Streaming Wars Heat Up as Platforms Compete for Exclusive Content', description: 'Major services invest billions in original programming to attract and retain subscribers.' },
  { title: 'Music Awards Ceremony Celebrates Diverse Array of Breakthrough Artists', description: 'Industry honors emerging talent across genres, highlighting cultural impact and innovation.' },
  { title: 'Acclaimed Director Announces Ambitious Sci-Fi Trilogy Project', description: 'Oscar-winning filmmaker reveals plans for epic space opera with $500 million budget.' },
  { title: 'Reality TV Show Becomes Cultural Phenomenon with Record Viewership', description: 'Unexpected hit captures global attention, dominating social media conversations.' },
];

const healthNews = [
  { title: 'New Cancer Treatment Shows 90% Success Rate in Clinical Trials', description: 'Revolutionary immunotherapy approach offers hope for patients with previously untreatable cancers.' },
  { title: 'Study Links Mediterranean Diet to Increased Longevity and Brain Health', description: 'Comprehensive research demonstrates significant benefits of traditional dietary patterns.' },
  { title: 'Wearable Technology Now Capable of Detecting Early Disease Symptoms', description: 'Smart devices use AI to identify health issues before they become serious medical problems.' },
  { title: 'Mental Health App Shows Promising Results in Reducing Anxiety and Depression', description: 'Digital therapy platform proves as effective as traditional counseling in peer-reviewed study.' },
  { title: 'Breakthrough Gene Therapy Cures Rare Genetic Disorder in Children', description: 'Medical advancement offers permanent solution for condition that affects thousands worldwide.' },
];

const scienceNews = [
  { title: 'Space Telescope Discovers Earth-Like Planets in Nearby Star System', description: 'Astronomers identify potentially habitable worlds just 40 light-years from our solar system.' },
  { title: 'Climate Scientists Report Unexpected Positive Trends in Ocean Recovery', description: 'Marine ecosystems show resilience as conservation efforts begin to yield measurable results.' },
  { title: 'Archaeologists Unearth 3,000-Year-Old City with Intact Artifacts', description: 'Discovery provides unprecedented insights into ancient civilization and daily life.' },
  { title: 'Particle Physics Experiment Reveals Evidence of New Fundamental Force', description: 'Groundbreaking findings at particle accelerator challenge our understanding of universe.' },
  { title: 'Biologists Discover Species Thought Extinct for 100 Years', description: 'Rediscovery of rare animal offers hope for conservation and biodiversity efforts.' },
];

const politicsNews = [
  { title: 'International Summit Reaches Historic Climate Agreement', description: 'Nations commit to ambitious carbon reduction targets and renewable energy investments.' },
  { title: 'Legislative Reform Package Passes with Bipartisan Support', description: 'Major policy changes address infrastructure, healthcare, and education priorities.' },
  { title: 'Election Results Signal Shift in Political Landscape Across Region', description: 'Voters express desire for change as new leadership emerges from closely watched races.' },
  { title: 'Diplomatic Breakthrough: Long-Standing Conflict Sees Peace Negotiations', description: 'International mediators facilitate dialogue between parties in decades-long dispute.' },
  { title: 'Government Announces Sweeping Digital Rights and Privacy Legislation', description: 'New laws aim to protect citizens in the digital age while fostering technological innovation.' },
];

const getRandomElement = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomDate = (daysAgo: number = 30): string => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

const generateArticleId = (index: number, category: string): string => {
  return `${category.toLowerCase()}-${index}-${Date.now()}`;
};

const createArticle = (
  category: NewsCategory,
  data: { title: string; description: string },
  index: number
): NewsArticle => {
  const publishedDate = getRandomDate();
  
  return {
    id: generateArticleId(index, category),
    title: data.title,
    description: data.description,
    content: `${data.description}\n\nThis is a detailed article about ${data.title.toLowerCase()}. The story has been developing over the past few days, with experts weighing in on its significance and potential impact.\n\nAccording to sources close to the matter, this represents a significant development in the field. Industry analysts suggest that the implications could be far-reaching, affecting not just immediate stakeholders but the broader ecosystem as well.\n\nFurther updates are expected as the situation continues to evolve.`,
    sourceUrl: `https://example.com/article/${generateArticleId(index, category)}`,
    imageUrl: `https://picsum.photos/seed/${generateArticleId(index, category)}/800/600`,
    source: getRandomElement(sources),
    author: getRandomElement(mockAuthors),
    category,
    publishedDate,
    createdAt: publishedDate,
  };
};

// Generate all mock articles
const generateMockArticles = (): NewsArticle[] => {
  const articles: NewsArticle[] = [];
  
  technologyNews.forEach((data, i) => articles.push(createArticle('Technology', data, i)));
  businessNews.forEach((data, i) => articles.push(createArticle('Business', data, i)));
  sportsNews.forEach((data, i) => articles.push(createArticle('Sports', data, i)));
  entertainmentNews.forEach((data, i) => articles.push(createArticle('Entertainment', data, i)));
  healthNews.forEach((data, i) => articles.push(createArticle('Health', data, i)));
  scienceNews.forEach((data, i) => articles.push(createArticle('Science', data, i)));
  politicsNews.forEach((data, i) => articles.push(createArticle('Politics', data, i)));
  
  // Sort by published date (newest first)
  return articles.sort((a, b) => 
    new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  );
};

export const MOCK_ARTICLES = generateMockArticles();

