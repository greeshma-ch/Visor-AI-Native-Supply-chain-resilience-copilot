import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const suppliers = [
  { name: 'Advanced Micro Circuits', location: 'Taiwan, Hsinchu' },
  { name: 'Global Logistics Hub', location: 'Netherlands, Rotterdam' },
  { name: 'South Sea Textiles', location: 'Vietnam, Ho Chi Minh' },
  { name: 'Bavarian Motor Parts', location: 'Germany, Munich' },
  { name: 'Tokyo Electron Components', location: 'Japan, Tokyo' },
  { name: 'Organic Grain Corp', location: 'USA, Chicago' },
  { name: 'BioGen Therapeutics', location: 'Switzerland, Zurich' }
];

async function testNewsQuery(query: string) {
  const apiKey = process.env.NEWS_API_KEY;
  console.log(`\n--- Testing Query: "${query}" ---`);
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data: any = await response.json();
    console.log("Status:", response.status, "statusField:", data.status);
    if (data.status === "error") {
      console.log("Error details:", data.message);
    } else {
      console.log("Articles count:", data.articles?.length || 0);
      data.articles?.slice(0, 3).forEach((a: any, i: number) => {
        console.log(`Article ${i+1}: [${a.source?.name}] ${a.title}`);
        console.log(`   Description: ${a.description?.substring(0, 150)}`);
      });
    }
  } catch (err: any) {
    console.error("Fetch Error:", err.message);
  }
}

async function run() {
  // 1. Stale / Old query in server.ts for global risk signals
  const oldGlobalQuery = `supply chain disruption logistics Taiwan, Hsinchu Netherlands, Rotterdam Vietnam, Ho Chi Minh Germany, Munich Japan, Tokyo`;
  await testNewsQuery(oldGlobalQuery);

  // 2. Proposing unique locations query
  const locations = suppliers.flatMap(s => s.location.split(',').map(part => part.trim()));
  const uniqueLocs = Array.from(new Set(locations)).filter(Boolean);
  const locQuery = uniqueLocs.map(l => l.includes(" ") ? `"${l}"` : l).join(" OR ");
  const proposedGlobalQuery = `("supply chain" OR "logistics" OR "shipping" OR "freight") AND (disruption OR strike OR weather OR bottleneck OR delay OR port OR typhoon OR flood OR earthquake) AND (${locQuery})`;
  await testNewsQuery(proposedGlobalQuery);

  // 3. Proposing broad query for supply chain disruptions
  const broadQuery = `("supply chain" OR "logistics" OR "shipping" OR "cargo") AND (disruption OR strike OR weather OR bottleneck OR delay OR port OR cyberattack OR shutdown)`;
  await testNewsQuery(broadQuery);
}

run();
