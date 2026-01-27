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
      content:
        'Researchers have unveiled a revolutionary artificial intelligence system that demonstrates unprecedented understanding of complex reasoning tasks.\n\n' +
        'Early evaluations suggest the model can chain together multi-step arguments, correct itself when presented with new evidence, and explain its reasoning in a way that is easier for people to validate. Several independent labs reproduced key results and reported consistent performance across a broad set of benchmarks.\n\n' +
        'Experts caution that real-world deployment will require careful testing around reliability, bias, and security. Nonetheless, the breakthrough is expected to accelerate adoption in industries like healthcare, finance, education, and software development.\n\n' +
        'Over the coming weeks, researchers plan to publish additional technical details, open evaluation datasets, and guidance for safe usage so organizations can measure impact and apply appropriate safeguards.',
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
      content:
        'Stock markets worldwide experienced significant gains following the release of better-than-expected employment and inflation reports.\n\n' +
        'Analysts say the data points to a resilient economy, with consumer spending holding steady while inflation pressures cool in several key sectors. Bond yields moved modestly, reflecting improved sentiment and expectations of a more stable policy path.\n\n' +
        'Market strategists noted that rally breadth improved, with cyclical sectors outperforming defensives. Still, they warned that upcoming earnings and central bank commentary could quickly reshape risk appetite.\n\n' +
        'Investors will be watching closely for revisions to forward guidance, additional inflation prints, and any signs of labor market softening that could alter the trajectory of rates and global growth forecasts.',
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
      content:
        'In one of the most thrilling championship games in recent memory, the underdog team mounted an incredible comeback.\n\n' +
        'After trailing for most of the contest, the team tightened its defense in the final quarter and went on a decisive run sparked by key stops, timely three-pointers, and a standout performance from the bench unit. The crowd erupted as the game swung dramatically in the closing minutes.\n\n' +
        'Coaches credited preparation and composure under pressure, noting that adjustments at halftime opened up better looks and reduced turnovers. Players described the win as a testament to chemistry and belief built throughout the season.\n\n' +
        'The celebration continues as fans mark a title many thought impossible, while analysts debate how this upset will reshape expectations for the league next season.',
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

