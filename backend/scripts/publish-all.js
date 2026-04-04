const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://dn4042@localhost:5432/newsapp' } } });

async function run() {
  const qc = await prisma.editorQueue.count();
  const pc = await prisma.publishedStory.count();
  const ac = await prisma.article.count();
  const sc = await prisma.storyCluster.count();
  console.log(`Articles: ${ac}, Clusters: ${sc}, Queue: ${qc}, Published: ${pc}`);

  // Get pending queue items and auto-publish them
  const pending = await prisma.editorQueue.findMany({
    where: { status: 'pending' },
    include: {
      cluster: {
        include: { articles: { take: 1, orderBy: { sourceAuthority: 'desc' } } },
      },
    },
  });

  console.log(`Pending queue items to publish: ${pending.length}`);

  for (const item of pending) {
    const primary = item.cluster.articles[0];
    if (!primary) continue;

    // Check if already published for this queue item
    const exists = await prisma.publishedStory.findUnique({ where: { queueId: item.id } });
    if (exists) { console.log(`  Skip (already published): ${primary.title.slice(0,50)}`); continue; }

    await prisma.editorQueue.update({
      where: { id: item.id },
      data: { status: 'approved' },
    });

    await prisma.publishedStory.create({
      data: {
        clusterId: item.clusterId,
        queueId: item.id,
        edition: item.edition,
        editionDate: item.editionDate,
        feedRank: item.suggestedRank,
        headline: primary.title,
        summary: primary.description || primary.title,
        whyMatters: 'This story is significant for Australian markets, policy, or daily life.',
        doubleClick: primary.content || primary.description || 'Full analysis coming soon.',
        category: primary.category || 'Business',
        tier: item.suggestedRank <= 2 ? 1 : item.suggestedRank <= 4 ? 2 : 3,
        isBreaking: false,
      },
    });
    console.log(`  Published: ${primary.title.slice(0,60)}`);
  }

  const finalCount = await prisma.publishedStory.count();
  console.log(`\nTotal published stories now: ${finalCount}`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
