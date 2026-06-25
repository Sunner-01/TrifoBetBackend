const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const juegos = await prisma.juegoCasino.findMany();
  let updatedCount = 0;
  
  for (let j of juegos) {
    if (j.url_juego && j.url_juego.includes('http://localhost:8080')) {
      const newUrl = j.url_juego.replace('http://localhost:8080', 'https://trifo-bet-juegos.vercel.app');
      await prisma.juegoCasino.update({
        where: { id: j.id },
        data: { url_juego: newUrl }
      });
      updatedCount++;
      console.log(`Updated game ${j.id}: ${newUrl}`);
    } else if (j.url_juego && j.url_juego.includes('http://192.168.1.8:8080')) {
      const newUrl = j.url_juego.replace('http://192.168.1.8:8080', 'https://trifo-bet-juegos.vercel.app');
      await prisma.juegoCasino.update({
        where: { id: j.id },
        data: { url_juego: newUrl }
      });
      updatedCount++;
      console.log(`Updated game ${j.id}: ${newUrl}`);
    }
  }
  
  console.log(`Finished updating ${updatedCount} games.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
