import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Categories
  const categories = [
    { name: 'Technology', slug: 'technology' },
    { name: 'Business', slug: 'business' },
    { name: 'Sports', slug: 'sports' },
    { name: 'Health', slug: 'health' },
    { name: 'Science', slug: 'science' },
    { name: 'Entertainment', slug: 'entertainment' },
    { name: 'Politics', slug: 'politics' },
    { name: 'World', slug: 'world' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  console.log('✅ Categories seeded');

  // Seed Test User
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@dailydigest.com' },
    update: {},
    create: {
      email: 'test@dailydigest.com',
      passwordHash: hashedPassword,
      name: 'Test User',
      theme: 'light',
    },
  });

  console.log('✅ Test user created:', testUser.email);

  // Seed Sample Articles
  const sampleArticles = [
    {
      title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
      description: 'Researchers have unveiled a revolutionary artificial intelligence system that demonstrates unprecedented understanding of complex reasoning tasks.',
      content: 'Full article content here...',
      imageUrl: 'https://picsum.photos/seed/tech1/1080/720',
      source: 'TechCrunch',
      category: 'Technology',
      author: 'John Smith',
      publishedAt: new Date('2026-01-18T10:00:00Z'),
      url: 'https://example.com/ai-breakthrough-2026',
    },
    {
      title: 'Global Markets Rally as Economic Data Exceeds Expectations',
      description: 'Stock markets worldwide experienced significant gains following the release of better-than-expected employment and inflation reports.',
      content: 'Full article content here...',
      imageUrl: 'https://picsum.photos/seed/business1/1080/720',
      source: 'Bloomberg',
      category: 'Business',
      author: 'Jane Doe',
      publishedAt: new Date('2026-01-18T08:00:00Z'),
      url: 'https://example.com/markets-rally-2026',
    },
    {
      title: 'Championship Victory: Underdog Team Wins Historic Finals',
      description: 'In one of the most thrilling championship games in recent memory, the underdog team mounted an incredible comeback.',
      content: 'Full article content here...',
      imageUrl: 'https://picsum.photos/seed/sports1/1080/720',
      source: 'ESPN',
      category: 'Sports',
      author: 'Mike Johnson',
      publishedAt: new Date('2026-01-18T06:00:00Z'),
      url: 'https://example.com/championship-victory-2026',
    },
  ];

  for (const article of sampleArticles) {
    await prisma.article.upsert({
      where: { url: article.url },
      update: {},
      create: article,
    });
  }

  console.log('✅ Sample articles seeded');
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

